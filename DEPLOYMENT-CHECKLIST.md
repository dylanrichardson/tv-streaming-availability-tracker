# Deployment Checklist

Quick reference for deploying StreamTrack changes safely.

## Pre-Deployment (Local)

### 1. Run Critical Tests Locally

```bash
# Terminal 1: Start backend
cd worker && npx wrangler dev

# Terminal 2: Start frontend
cd frontend && npm run dev
```

**Run these 4 tests via browser MCP:**
- [ ] Test 1: Basic Page Load
- [ ] Test 4: Import Titles Flow (Success Path)
- [ ] Test 6: Import Modal Cancel
- [ ] Test 10: Navigation Between Pages

**Verification:**
```bash
# Terminal 3: Verify API
curl http://127.0.0.1:8787/api/titles | jq

# Check for console errors in browser DevTools
# Verify no TypeScript errors in terminals
```

## Deployment

### 2. Deploy Worker

```bash
cd worker
npx wrangler deploy
```

**Verify:**
```bash
curl https://streamtrack-api.dylanrichardson1996.workers.dev/api/titles
# Should return: {"titles":[...]}
```

### 3. Deploy Frontend

```bash
git add .
git commit -m "Your change description"
git push origin main
```

**Verify GitHub Actions:**
```bash
# Wait 2-3 minutes, then check:
gh run list --limit 1
# Should show: ✓ Deploy to GitHub Pages

# Or open in browser:
gh repo view --web
# Navigate to Actions tab
```

**Verify site deployed:**
```bash
curl -I https://dylanrichardson.github.io/tv-streaming-availability-tracker/
# Should return: HTTP/2 200
```

## Post-Deployment (Production)

### 4. Run Quick Smoke Test

```bash
# Navigate to production
mcp__browsermcp__browser_navigate: https://dylanrichardson.github.io/tv-streaming-availability-tracker/
```

**Run these 3 tests:**
- [ ] Test 1: Basic Page Load
- [ ] Test 4: Import Titles Flow (Success Path)
- [ ] Test 8: Analytics Page (With Data)

**Verify:**
```bash
curl https://streamtrack-api.dylanrichardson1996.workers.dev/api/titles | jq
# Check for any errors in production logs
npx wrangler tail --format pretty
```

## If Something Goes Wrong

### Rollback Worker
```bash
cd worker
npx wrangler rollback --message "Rollback due to [reason]"
```

### Rollback Frontend
```bash
git revert HEAD
git push origin main
# Wait for GitHub Actions to redeploy
```

## Test Strategy Matrix

| Change Type | Local Tests | Production Tests | Notes |
|-------------|-------------|------------------|-------|
| **Bug fix** | 4 critical | Quick smoke test (3) | Fast iteration |
| **New feature** | 4 critical | Quick smoke test (3) | Verify feature works |
| **API changes** | 4 critical | Full suite (15) | Test all integrations |
| **Schema update** | 4 critical | Full suite (15) | Data integrity critical |
| **UI tweaks** | 1-2 relevant | 1-2 relevant | Visual verification only |

## Time Estimates

- **Local tests (4):** ~5 minutes
- **Deploy backend:** ~30 seconds
- **Deploy frontend:** ~2-3 minutes (GitHub Actions)
- **Production smoke test (3):** ~5 minutes
- **Production full suite (15):** ~15-20 minutes

**Total for typical deployment:** ~10-15 minutes

## Notes

- Always test locally first (saves time + resources)
- Use selective testing to avoid JustWatch rate limits
- Full test suite only needed for major changes
- Keep production data in mind (don't delete user titles!)
- Check both worker logs AND browser console for errors
