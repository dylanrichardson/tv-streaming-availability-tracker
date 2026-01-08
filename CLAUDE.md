# Claude Development Guide

Instructions for AI-assisted development of StreamTrack.

## Worktree Coordination

When multiple Claude agents work on this codebase, use git worktrees with lockfile coordination to prevent conflicts.

### Symmetric Worktree Design

All worktrees are equal and follow the naming convention: `streamtrack-worktree-N` where N starts at **0**.

- **streamtrack-worktree-0**: The original repository clone (renamed for consistency)
- **streamtrack-worktree-1, 2, 3...**: Additional worktrees created on demand

**Key principle:** worktree-0 is NOT special. It follows the same lockfile protocol as all other worktrees.

### Worktree Lockfile Protocol

**Before starting ANY task (documentation, code changes, etc.):**

1. **Find an available worktree** (or create a new one if all are locked):

```bash
# Check for existing worktrees starting from 0
# Prefer reusing existing worktrees over creating new ones
WORKTREE_FOUND=false
for i in {0..10}; do
  WORKTREE_PATH="/Users/dylan.richardson/toast/git-repos/streamtrack-worktree-$i"
  LOCKFILE="$WORKTREE_PATH/.claude-lock"

  if [ -d "$WORKTREE_PATH" ]; then
    if [ ! -f "$LOCKFILE" ]; then
      # Found an available existing worktree
      echo "Available worktree: $WORKTREE_PATH"
      cd "$WORKTREE_PATH"
      WORKTREE_FOUND=true
      break
    fi
  else
    # No worktree at this number, we can create it
    echo "Creating new worktree: $WORKTREE_PATH"
    # Create from worktree-0 if we're not in a worktree already
    cd /Users/dylan.richardson/toast/git-repos/streamtrack-worktree-0
    git worktree add "$WORKTREE_PATH" -b "worktree-$i-$(date +%s)"
    cd "$WORKTREE_PATH"
    WORKTREE_FOUND=true
    break
  fi
done
```

2. **Claim the worktree with a lockfile**:

```bash
# Create lockfile with timestamp and task description
echo "Locked by Claude agent at $(date -Iseconds)" > .claude-lock
echo "PID: $$" >> .claude-lock
echo "Task: <brief task description>" >> .claude-lock

# Verify lockfile is gitignored (should already be in .gitignore)
```

3. **Do your work** (make changes, commit, test)

4. **Merge to main and push**:

```bash
# Update main branch locally
git checkout main
git pull origin main --rebase

# Merge your changes
git merge <your-branch> --no-ff -m "Descriptive commit message"

# Push to origin
git push origin main
```

**After completing task:**

```bash
# Remove lockfile to release worktree for next agent
rm -f .claude-lock

# Clean up feature branch
git branch -d <your-branch>
```

### Worktree Management Commands

```bash
# List all worktrees and their status
git worktree list

# Check lock status of all worktrees (run from any worktree)
for i in {0..10}; do
  WORKTREE_PATH="/Users/dylan.richardson/toast/git-repos/streamtrack-worktree-$i"
  if [ -d "$WORKTREE_PATH" ]; then
    if [ -f "$WORKTREE_PATH/.claude-lock" ]; then
      echo "LOCKED: worktree-$i"
      head -n 3 "$WORKTREE_PATH/.claude-lock" | sed 's/^/  /'
    else
      echo "AVAILABLE: worktree-$i"
    fi
  fi
done

# Remove stale worktree (if agent crashed and didn't cleanup)
git worktree remove /Users/dylan.richardson/toast/git-repos/streamtrack-worktree-X
git branch -D worktree-X-<timestamp>

# Prune stale worktree references
git worktree prune
```

### Worktree Strategy

**Prefer reusing existing worktrees:**
- Avoids creating many worktrees unnecessarily (faster startup)
- Check worktree-0, 1, 2, 3... in sequence
- First unlocked worktree wins

**Create new worktrees when:**
- All existing worktrees are locked (parallel agents working)
- Follow naming convention: streamtrack-worktree-N where N is the next sequential number

**Lockfile contents (.claude-lock):**
```
Locked by Claude agent at 2026-01-08T14:30:00-08:00
PID: 12345
Task: Implementing streaming service filter UI
```

**Important notes:**
- The `.claude-lock` file must be in `.gitignore` (never commit it)
- If a lockfile is older than 2 hours, consider it stale and safe to claim
- Always clean up your lockfile when done, even if task fails
- Lockfiles prevent race conditions when multiple agents start simultaneously
- **Always use worktrees, even for single agent work** - this ensures consistency

### .gitignore Entry

Ensure this line exists in `.gitignore`:

```
.claude-lock
```

---

## Testing & Monitoring

### Browser Testing (MCP Tool)

Use the browser MCP tool to test the deployed frontend interactively:

```
# Navigate to the live site
mcp__browsermcp__browser_navigate: https://dylanrichardson.github.io/tv-streaming-availability-tracker/

# Take screenshots to verify UI state
mcp__browsermcp__browser_screenshot

# Get console logs (errors, warnings, debug output)
mcp__browsermcp__browser_get_console_logs

# Get accessibility snapshot (page structure, elements, refs)
mcp__browsermcp__browser_snapshot

# Interact with elements (click, type, etc)
mcp__browsermcp__browser_click
mcp__browsermcp__browser_type
mcp__browsermcp__browser_hover

# Navigate browser
mcp__browsermcp__browser_go_back
mcp__browsermcp__browser_go_forward

# Wait for async operations
mcp__browsermcp__browser_wait
```

**When to use browser testing:**
- Validating end-to-end user flows
- Verifying UI changes after frontend deployment
- Testing edge cases that are hard to reproduce manually
- Debugging issues that only appear in production
- Checking console for JavaScript errors or warnings

**Important notes:**
- Browser extension must be connected (click extension icon, click "Connect")
- Can view DevTools console logs via `mcp__browsermcp__browser_get_console_logs`
- Screenshots are returned as images for visual verification
- Use `browser_snapshot` to get element references before clicking/typing

### Wrangler CLI (Cloudflare)

Test the deployed API directly:

```bash
# Check worker is running
curl https://streamtrack-api.dylanrichardson1996.workers.dev/api/titles

# Import test titles
curl -X POST https://streamtrack-api.dylanrichardson1996.workers.dev/api/sync \
  -H "Content-Type: application/json" \
  -d '{"titles": ["The Matrix", "Breaking Bad"]}'

# Get history for a title (use ID from /api/titles response)
curl https://streamtrack-api.dylanrichardson1996.workers.dev/api/history/1

# Get service statistics
curl https://streamtrack-api.dylanrichardson1996.workers.dev/api/stats/services

# Manually trigger availability check (populates history)
curl -X POST https://streamtrack-api.dylanrichardson1996.workers.dev/api/trigger-check

# View worker logs in real-time
cd worker && npx wrangler tail
```

### D1 Database CLI

Query the database directly:

```bash
cd worker

# List all titles
npx wrangler d1 execute streamtrack --remote --command "SELECT * FROM titles"

# Check availability logs
npx wrangler d1 execute streamtrack --remote --command "SELECT * FROM availability_logs ORDER BY check_date DESC LIMIT 20"

# See service coverage
npx wrangler d1 execute streamtrack --remote --command "
  SELECT s.name, COUNT(*) as available_count
  FROM availability_logs al
  JOIN services s ON al.service_id = s.id
  WHERE al.is_available = 1
  GROUP BY s.name
"

# Check database size
npx wrangler d1 execute streamtrack --remote --command "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()"

# Get title count and capacity
npx wrangler d1 execute streamtrack --remote --command "
  SELECT COUNT(*) as total_titles,
         COUNT(CASE WHEN last_checked IS NULL THEN 1 END) as never_checked,
         COUNT(CASE WHEN last_checked >= datetime('now', '-1 day') THEN 1 END) as checked_24h
  FROM titles"
```

### Monitor-Metrics Skill

A Claude skill for reviewing metrics, errors, triage, debugging, and fixes. Located in `.claude/skills/monitor-metrics/SKILL.md`.

**Usage:**
```
Claude, please check the app health
Claude, why aren't titles being checked?
Claude, analyze the system performance over the last 7 days
```

The skill will:
1. Query D1 database for metrics (title counts, check status, availability logs)
2. Test API endpoints for responsiveness
3. Analyze recent activity and trends
4. Identify issues (stuck titles, rate limiting, errors)
5. Provide actionable fixes with exact commands

---

## Local Development

### Prerequisites

- Node.js 20+
- npm or pnpm
- Wrangler CLI

### Setup

```bash
# Install worker dependencies
cd worker
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Set up local D1 database
cd ../worker
npx wrangler d1 execute streamtrack --local --file=./schema.sql
```

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

### Troubleshooting

**"Cannot connect to API":**
- Check `npx wrangler dev` is running
- Verify API URL in `frontend/src/config.ts`
- Check CORS: Worker should return `Access-Control-Allow-Origin: *`

**"Database not found":**
```bash
cd worker
npx wrangler d1 execute streamtrack --local --file=./schema.sql
```

**Frontend shows stale data:**
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Clear localStorage: Open DevTools → Application → Local Storage → Clear

**JustWatch API failing:**
- Check worker logs in Terminal 1 for error messages
- Common causes: rate limiting, API endpoint changed, network issues

---

## Deployment

### Deployment Checklist

Use this checklist for every deployment:

#### Pre-Deployment (Local)
- [ ] Run selective local tests (4 critical scenarios from Test Scenarios section)
- [ ] Verify no console errors locally
- [ ] Commit all changes: `git status` shows clean

#### Deploy Backend
- [ ] `cd worker && npx wrangler deploy`
- [ ] Verify worker responds: `curl https://streamtrack-api.dylanrichardson1996.workers.dev/api/titles`
- [ ] Check logs: `npx wrangler tail` (optional)

#### Deploy Frontend
- [ ] `git push origin main`
- [ ] Wait 2-3 minutes for GitHub Actions to complete
- [ ] Verify site loads: `curl -I https://dylanrichardson.github.io/tv-streaming-availability-tracker/`
- [ ] Check Last-Modified header is recent (indicates new deployment)

#### Post-Deployment (Production)
- [ ] Run quick smoke test (3 scenarios) on production
- [ ] Verify user-facing functionality works
- [ ] Check for any errors in production logs

### Deployment Verification

#### Frontend Deployment (GitHub Actions)

Frontend auto-deploys when pushing to `main`. **DO NOT use `gh` CLI** - not supported.

**Verify deployment:**
```bash
# Wait 2-3 minutes after push, then check:
curl -I https://dylanrichardson.github.io/tv-streaming-availability-tracker/
# HTTP/2 200 = success
# Check Last-Modified header - should be recent

# Or open Actions in browser:
# https://github.com/dylanrichardson/tv-streaming-availability-tracker/actions
```

**Verify changes are live:**
```bash
# Check page title
curl -s https://dylanrichardson.github.io/tv-streaming-availability-tracker/ | grep "<title>"

# Test the app with browser MCP or manual testing
```

#### Worker Deployment

```bash
cd worker && npx wrangler deploy
# Verify immediately:
curl https://streamtrack-api.dylanrichardson1996.workers.dev/api/titles
```

### Rollback Plan

If production is broken:

```bash
# Rollback worker to previous version
cd worker
npx wrangler rollback --message "Rollback due to issue"

# Rollback frontend
git revert HEAD
git push origin main
# Wait for GitHub Actions to redeploy
```

### Test Strategy Matrix

| Change Type | Local Tests | Production Tests | Notes |
|-------------|-------------|------------------|-------|
| **Bug fix** | 4 critical | Quick smoke test (3) | Fast iteration |
| **New feature** | 4 critical | Quick smoke test (3) | Verify feature works |
| **API changes** | 4 critical | Full suite (15) | Test all integrations |
| **Schema update** | 4 critical | Full suite (15) | Data integrity critical |
| **UI tweaks** | 1-2 relevant | 1-2 relevant | Visual verification only |

---

## Key Files

| File | Purpose |
|------|---------|
| `worker/src/index.ts` | API routing and CORS |
| `worker/src/services/justwatch.ts` | JustWatch API integration |
| `worker/src/services/database.ts` | D1 queries |
| `worker/src/scheduled.ts` | Cron job (every 4 hours) |
| `worker/src/config.ts` | Configuration constants |
| `frontend/src/config.ts` | API URL configuration |
| `frontend/src/hooks/useApi.ts` | API client |
| `frontend/src/pages/Watchlist.tsx` | Main watchlist page |
| `frontend/src/pages/Analytics.tsx` | Analytics and recommendations |

---

## Test Scenarios

### Running Tests

**Locally (before push):**
1. Local backend running: `cd worker && npx wrangler dev`
2. Local frontend running: `cd frontend && npm run dev`
3. Test against: `http://localhost:5173/tv-streaming-availability-tracker/`

**Production (after deployment):**
1. Test against: `https://dylanrichardson.github.io/tv-streaming-availability-tracker/`

### Critical Tests (Run Before Every Push)

#### Test 1: Basic Page Load
- Navigate to site
- Verify page title is "frontend"
- Verify header shows "TV Streaming Availability Tracker"
- Verify navigation has "My Watchlist" and "Analytics" links
- No console errors

#### Test 4: Import Titles Flow (Success Path)
1. Click "+ Import Titles" button
2. Type into textarea: "The Matrix\nBreaking Bad\nSuccession"
3. Click "Import" button
4. Verify success message shows "X created"
5. Verify watchlist shows imported titles

#### Test 6: Import Modal Cancel
1. Click "+ Import Titles" button
2. Type something into textarea
3. Click "Cancel" button
4. Verify modal closes without side effects

#### Test 10: Navigation Between Pages
1. Start on Watchlist page
2. Click "Analytics" link
3. Verify Analytics page content displays
4. Click "My Watchlist" link
5. Verify Watchlist content displays

### Full Test Suite (15 Tests)

Run after major changes:

1. **Basic Page Load** - Site loads successfully
2. **Empty State Display** - Empty watchlist shows appropriate messaging
3. **Import Modal Opens** - Import modal displays when clicking import button
4. **Import Titles Flow (Success Path)** - User can successfully import titles
5. **Import Titles Flow (Not Found)** - UI handles titles not found in JustWatch
6. **Import Modal Cancel** - User can cancel import without submitting
7. **Analytics Page (Empty State)** - Analytics page displays correctly when no data exists
8. **Analytics Page (With Data)** - Analytics displays charts and recommendations
9. **Title Detail View** - Clicking on a title shows availability history
10. **Navigation Between Pages** - User can navigate between Watchlist and Analytics
11. **Manual Availability Check Trigger** - User can manually trigger availability check
12. **Error Handling - API Unavailable** - UI gracefully handles API being down
13. **Responsive Design (Mobile)** - Site works on mobile viewport
14. **JustWatch API Integration** - Verify JustWatch API is being called correctly
15. **Database State Verification** - Verify database reflects UI state

**Test execution tips:**
- Run tests in order (empty state before populated state)
- Some tests depend on others (e.g., test 8 needs titles from test 4)
- Screenshot failures for debugging
- Combine browser tests with API curl calls for full verification

---

## Future Enhancements

### High Priority: Title Management

#### 1. Search Before Import
**Problem:** Users can't preview what will be imported, leading to wrong matches

**Solution:**
- Add search functionality that shows JustWatch results BEFORE importing
- Display: title, year, type, poster, services currently available
- User selects exact match, then adds to tracking

**Implementation:**
- Frontend: New search component with JustWatch results preview
- Backend: Already have `/api/sync` - expose search separately
- **Estimate:** 2-3 hours

#### 2. Remove Title from Tracking
**Problem:** No way to remove incorrectly imported titles

**Solution:**
- Add delete button on title cards
- Confirmation dialog
- Backend: `DELETE /api/titles/:id`

**Implementation:**
```typescript
export async function deleteTitle(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM availability_logs WHERE title_id = ?').bind(id).run();
  await db.prepare('DELETE FROM titles WHERE id = ?').bind(id).run();
}
```

**Estimate:** 30 minutes

#### 3. Post-Import Disambiguation
**Problem:** After bulk import, some titles might match wrong versions

**Solution:**
- After import, show "Review Ambiguous Matches" step
- Display titles with multiple possible matches
- Let user confirm or switch to different version

**Estimate:** 4-6 hours

---

## Authentication Research

If implementing authentication for per-user features:

### Quick Recommendation

**Best Choice: Supabase Auth**
- Most generous free tier (50,000 MAU)
- Includes database (could migrate from D1)
- Good Cloudflare Workers integration
- Open source, no vendor lock-in

**Runner-up: Clerk**
- Best developer experience for React
- Pre-built UI components
- 10,000 MAU free tier
- Great for quick implementation

### Detailed Comparison

| Provider | Free MAU | Setup Time | React DX | CF Workers | Open Source | Branding Free |
|----------|----------|------------|----------|------------|-------------|---------------|
| **Supabase** | 50K | 2-3hr | Good | Good | Yes | Yes* |
| **Clerk** | 10K | 1hr | Excellent | Good | No | No |
| **Firebase** | Unlimited | 3-4hr | Fair | Fair | No | Yes |
| **Auth0** | 7.5K | 4-5hr | Fair | Good | No | Yes |

\* Email branding only

### Implementation Plan (Supabase)

```typescript
// 1. Frontend: Add Supabase client
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 2. Add login UI
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google'
})

// 3. Worker: Verify JWT
const token = request.headers.get('Authorization')?.replace('Bearer ', '')
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
const { data: { user }, error } = await supabase.auth.getUser(token)
```

### Database Migration for Auth

```sql
-- Add user_id column to titles table
ALTER TABLE titles ADD COLUMN user_id TEXT;
CREATE INDEX idx_titles_user_id ON titles(user_id);

-- Filter queries by user
SELECT * FROM titles WHERE user_id = ?
```

### Auth Considerations

**With auth, you can:**
- Limit imports per user (e.g., 100 titles max)
- Track per-user preferences
- Send notifications when titles become available
- Add private watchlists

**Tradeoffs:**
- More complex setup
- Requires user accounts
- Loses "shared database" simplicity
- Need migration strategy

### Recommendation

**For now:** Keep shared database model (no auth)
- Simpler, faster to build
- No vendor lock-in
- Scales with unique titles, not users
- Can always add auth later

**Add auth when:**
- Need per-user features (notifications, private lists)
- Ready to commit to a provider (Supabase recommended)
- Have migration plan for existing data

---

## Common Issues

**"Not found" on API calls**: Check CORS_ORIGIN in wrangler.toml, verify endpoint path

**Empty history**: Run `/api/trigger-check` to populate availability logs

**JustWatch errors**: API is unofficial and may rate-limit or change; check `wrangler tail`

**Database queries failing**: Verify D1 binding name matches code (`env.DB`)

**gh CLI errors**: Don't use `gh` CLI - not supported (multiple account issues). Use curl + web browser instead.

**Titles not being checked**:
1. Check cron is running (look for recent availability_logs entries)
2. Verify titles have justwatch_id
3. Check worker logs for errors
4. Manually trigger: `/api/trigger-check`

**Rate limiting from JustWatch**:
1. Check request frequency in logs
2. Increase delay: Edit `CONFIG.API_DELAY_MS` in worker/src/config.ts
3. Deploy changes
