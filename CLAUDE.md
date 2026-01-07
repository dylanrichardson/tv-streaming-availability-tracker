# Claude Development Guide

Instructions for AI-assisted development of StreamTrack.

## Testing & Monitoring

### Browser Testing (MCP Tool)

Use the browser MCP tool to test the deployed frontend interactively:

```
# Navigate to the live site
mcp__browsermcp__browser_navigate: https://dylanrichardson.github.io/tv-streaming-availability-tracker/

# Take screenshots to verify UI state
mcp__browsermcp__browser_screenshot

# Interact with elements (click, type, etc)
mcp__browsermcp__browser_click
mcp__browsermcp__browser_type
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

## Common Issues

**"Not found" on API calls**: Check CORS_ORIGIN in wrangler.toml, verify endpoint path

**Empty history**: Run `/api/trigger-check` to populate availability logs

**JustWatch errors**: API is unofficial and may rate-limit or change; check `wrangler tail`

**Database queries failing**: Verify D1 binding name matches code (`env.DB`)
