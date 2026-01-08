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

**Testing approach:**
- Run through test scenarios defined in `TESTS.md`
- Tests are written in plain English (informal Gherkin style)
- Claude can execute these autonomously without user intervention
- Combine browser testing with API calls and logs for full verification

**When to use browser testing:**
- Validating end-to-end user flows
- Verifying UI changes after frontend deployment
- Testing edge cases that are hard to reproduce manually
- Debugging issues that only appear in production
- Checking console for JavaScript errors or warnings

**Important notes:**
- Browser extension must be connected (click extension icon, click "Connect")
- Can view DevTools console logs via `mcp__browsermcp__browser_get_console_logs`
- Can change URL by calling `mcp__browsermcp__browser_navigate` again
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
```

### Local Development

```bash
# Run worker locally with local D1
cd worker
npx wrangler d1 execute streamtrack --local --file=./schema.sql
npx wrangler dev

# Run frontend pointing to local worker
cd frontend
# Edit config.ts to use http://localhost:8787
npm run dev
```

## Iterative Development Workflow

1. **Identify issue**: Use browser MCP tool, `curl`, or manual testing to find bugs
2. **Check logs**: `npx wrangler tail` shows runtime errors
3. **Query DB**: Verify data state with D1 CLI
4. **Fix code**: Edit worker/src or frontend/src
5. **Test locally**: `npx wrangler dev` for quick iteration
6. **Deploy**: `npx wrangler deploy`
7. **Verify**: Run automated browser tests from `TESTS.md` or use curl commands

## Key Files

| File | Purpose |
|------|---------|
| `worker/src/index.ts` | API routing and CORS |
| `worker/src/services/justwatch.ts` | JustWatch API integration |
| `worker/src/services/database.ts` | D1 queries |
| `worker/src/scheduled.ts` | Daily cron job |
| `frontend/src/config.ts` | API URL configuration |
| `frontend/src/hooks/useApi.ts` | API client |
| `TESTS.md` | Browser test scenarios (plain English) |

## Deployment Verification

### Frontend Deployment (GitHub Actions)

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

### Worker Deployment

```bash
cd worker && npx wrangler deploy
# Verify immediately:
curl https://streamtrack-api.dylanrichardson1996.workers.dev/api/titles
```

## Common Issues

**"Not found" on API calls**: Check CORS_ORIGIN in wrangler.toml, verify endpoint path

**Empty history**: Run `/api/trigger-check` to populate availability logs

**JustWatch errors**: API is unofficial and may rate-limit or change; check `wrangler tail`

**Database queries failing**: Verify D1 binding name matches code (`env.DB`)

**gh CLI errors**: Don't use `gh` CLI - not supported (multiple account issues). Use curl + web browser instead.
