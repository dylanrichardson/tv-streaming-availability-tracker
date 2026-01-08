# Monitoring & Observability

## Monitor-Metrics Skill

A Claude skill for reviewing metrics, errors, triage, debugging, and fixes.

### Usage

The skill is defined in `.claude/skills/monitor-metrics/SKILL.md` and can be invoked with:

**General health check:**
```
/monitor-metrics
```

**Specific question:**
```
/monitor-metrics "Why aren't titles being checked?"
```

**Custom timeframe:**
```
/monitor-metrics timeframe="7 days"
```

**With specific task:**
```
/monitor-metrics "Check queue system performance"
```

**Note:** The skill provides a structured framework for comprehensive analysis of logs, database metrics, API health, and common issues. It will automatically run the appropriate database queries and provide actionable insights.

### What It Does

The skill will:
1. Query D1 database for metrics (title counts, check status, availability logs)
2. Test API endpoints for responsiveness
3. Analyze recent activity and trends
4. Identify issues (stuck titles, rate limiting, errors)
5. Provide actionable fixes with exact commands

### Output

Either:
- **Specific answer** if you asked a question
- **Health report overview** with metrics, status, issues, and recommendations

### Available Queries

The skill knows how to:
- Check total titles and capacity usage
- Find titles that haven't been checked
- Verify queue system is working
- Analyze service availability stats
- Test API endpoints
- Diagnose common issues (rate limiting, stuck titles, duplicates)
- Suggest fixes with commands

### Example: Health Check

```
$ /monitor-metrics

## TV Streaming Availability Tracker Health Report

### ✅ Overall Status: Healthy

### 📊 Database
- Total titles: 5 of 5000 (0.1% capacity)
- Checked in last 24h: 2 titles
- Never checked: 0
- Availability logs: 280 entries

### 🔄 Queue System
- Status: ✅ Working
- Last check: 2 hours ago
- Distribution: Even
- Next batch: ~1 title in 2 hours

### 📡 API
- All endpoints responding
- Response time: <200ms
- No errors detected

### 💡 Recommendations
- System healthy
- Consider importing more titles (0.1% capacity used)
```

### Example: Specific Issue

```
$ /monitor-metrics "Why is Breaking Bad not showing any history?"

Checking Breaking Bad availability...

## Issue Found: Title Never Checked

Breaking Bad (ID: 1) has never been checked by the queue system.

**Reason:** Title was imported 2 hours ago, next cron run is in 1 hour.

**Status:** Normal - new titles are prioritized and will be checked on next cron run.

**To check immediately:**
```bash
curl -X POST https://streamtrack-api.dylanrichardson1996.workers.dev/api/trigger-check
```

**Timeline:**
- Imported: 2 hours ago
- last_checked: NULL
- Next cron: 1 hour from now
- Will be checked then (highest priority - NULL last_checked)
```

### Common Use Cases

**Verify everything is working:**
```
/monitor-metrics
```

**Debug queue issues:**
```
/monitor-metrics "Check if titles are being updated"
```

**Analyze performance:**
```
/monitor-metrics "How is the queue system performing?"
```

**Investigate errors:**
```
/monitor-metrics "Look for any errors in the last 24 hours"
```

**Check capacity:**
```
/monitor-metrics "How many titles can we still add?"
```

**Troubleshoot specific title:**
```
/monitor-metrics "Why is [title name] not showing availability?"
```

## Manual Monitoring

### Database Queries

```bash
cd worker

# Quick stats
npx wrangler d1 execute streamtrack --remote --command "
  SELECT
    (SELECT COUNT(*) FROM titles) as total_titles,
    (SELECT COUNT(*) FROM titles WHERE last_checked IS NULL) as never_checked,
    (SELECT COUNT(*) FROM titles WHERE last_checked >= datetime('now', '-1 day')) as checked_24h
"

# Service coverage
npx wrangler d1 execute streamtrack --remote --command "
  SELECT
    s.name,
    ROUND(CAST(SUM(CASE WHEN al.is_available = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 1) as pct
  FROM availability_logs al
  JOIN services s ON al.service_id = s.id
  WHERE al.check_date >= date('now', '-7 days')
  GROUP BY s.name
  ORDER BY pct DESC
"
```

### API Testing

```bash
# Test endpoints
curl -s https://streamtrack-api.dylanrichardson1996.workers.dev/api/titles | jq -r '.titles | length'
curl -s https://streamtrack-api.dylanrichardson1996.workers.dev/api/stats/services | jq

# Manually trigger check
curl -X POST https://streamtrack-api.dylanrichardson1996.workers.dev/api/trigger-check
```

### Worker Logs

```bash
cd worker
npx wrangler tail --format pretty
```

**Note:** Shows real-time logs only, not historical. For historical metrics, query the database.

## Key Metrics

### Health Indicators

**✅ Healthy:**
- All titles checked within 7 days
- No errors in logs
- API responding < 500ms
- Queue system running on schedule

**⚠️ Warning:**
- Some titles not checked in 7+ days
- Minor API errors (<5%)
- Database at >80% capacity

**🔴 Critical:**
- No titles checked in 24+ hours
- API down or timing out
- JustWatch rate limiting (429 errors)
- Database at >95% capacity

### Expected Behavior

**Queue System:**
- Cron runs every 4 hours (6x per day)
- Each title checked once per week
- Batch size: totalTitles / 42 runs per week
- Example: 420 titles = check 10 per run

**API Load:**
- 5000 titles = ~714 calls/day (~30/hour)
- 500ms delay between requests
- ~1 minute per cron run

**Database Growth:**
- 8 services × 7 days/title × 52 weeks = 2,912 logs per title per year
- 5000 titles × 2,912 = 14.6M rows/year
- Need cleanup strategy for >6 months old

## Alerts & Notifications

**TODO:** Set up alerts for:
- Cron failures (no checks in 8+ hours)
- API errors (>10% failure rate)
- Database capacity (>80%)
- Rate limiting detected

**For now:** Run `/monitor-metrics` daily or when suspicious.

## Troubleshooting Guide

### Titles Not Being Checked

1. Check cron is running: Look for recent availability_logs entries
2. Verify titles have justwatch_id
3. Check worker logs for errors
4. Manually trigger: `/api/trigger-check`

### Rate Limiting

1. Check request frequency in logs
2. Increase delay: Edit `CONFIG.API_DELAY_MS` in scheduled.ts
3. Reduce frequency: Increase `TARGET_CHECK_FREQUENCY_DAYS`
4. Deploy changes

### Database Slow

1. Check total log entries (>10M = concern)
2. Archive old logs (>6 months)
3. Add indexes if needed
4. Consider log cleanup cron

### API Errors

1. Check worker logs: `npx wrangler tail`
2. Test endpoints manually with curl
3. Check CORS configuration
4. Verify D1 binding is correct

## Future: Frontend Error Tracking

**TODO:** Add error logging to backend

**Options:**
1. POST to `/api/errors` endpoint
2. Use Sentry or similar
3. Store in separate D1 table
4. Monitor via skill

**For now:** Check browser console manually with browser MCP:
```
mcp__browsermcp__browser_navigate: https://dylanrichardson.github.io/tv-streaming-availability-tracker/
mcp__browsermcp__browser_get_console_logs
```
