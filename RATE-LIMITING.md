# JustWatch API Rate Limiting Strategy

Strategies to avoid spamming the JustWatch API and stay within reasonable limits.

## Current Situation

**Problem:**
- Currently checking ALL titles once per day at 6am UTC
- JustWatch API is unofficial and could rate-limit or ban us
- As user base grows, this doesn't scale (1000 users × 50 titles = 50,000 API calls/day)
- All calls happen at once (spike), not spread out

**Current Code:**
```typescript
// scheduled.ts - Runs daily at 6am UTC
for (const title of titles) {
  const availability = await getTitleAvailability(...)
  await new Promise(resolve => setTimeout(resolve, 200)) // 200ms delay
}
```

---

## Cloudflare Workers Cron Pricing

**Free Tier:**
- ✅ Cron Triggers are FREE on all plans
- ✅ Can run as frequently as every minute (`* * * * *`)
- ✅ No additional cost for cron invocations
- ⚠️ Still count toward request limits (100k/day on free tier)

**Limits:**
- Workers Free: 100,000 requests/day
- Cron triggers: Unlimited frequency
- CPU time: 10ms per request (free tier)

**Source:** Cloudflare Workers are billed per request, cron triggers are just scheduled requests.

---

## Rate Limiting Strategies

### Strategy 1: Spread Checks Throughout Day (Recommended)

**Approach:** Run cron every hour and check a subset of titles

**Implementation:**
```typescript
// wrangler.toml
[triggers]
crons = ["0 * * * *"]  // Every hour instead of once daily

// scheduled.ts
export async function handleScheduled(env: Env): Promise<void> {
  const allTitles = await getAllTitles(env.DB);
  const hour = new Date().getUTCHours();

  // Divide titles into 24 buckets (one per hour)
  const titlesPerHour = Math.ceil(allTitles.length / 24);
  const startIdx = hour * titlesPerHour;
  const endIdx = Math.min(startIdx + titlesPerHour, allTitles.length);

  const titlesToCheck = allTitles.slice(startIdx, endIdx);

  console.log(`Hour ${hour}: Checking ${titlesToCheck.length} titles`);

  for (const title of titlesToCheck) {
    await checkAndLogAvailability(title);
    await delay(500); // 500ms between requests
  }
}
```

**Pros:**
- ✅ Spreads load throughout day (no spike)
- ✅ Each title still checked once per day
- ✅ Reduces JustWatch rate limit risk
- ✅ Free cron frequency

**Cons:**
- ⚠️ Slightly more complex logic
- ⚠️ Data could be up to 24 hours old for any given title

**API Calls:** Same total (N titles/day), but spread over 24 hours instead of 1 minute

---

### Strategy 2: Check Based on User Activity

**Approach:** Only check titles that users have viewed recently

**Implementation:**
```typescript
// Add last_viewed column to titles table
ALTER TABLE titles ADD COLUMN last_viewed DATETIME;

// Update last_viewed when user views title
await db.prepare('UPDATE titles SET last_viewed = ? WHERE id = ?')
  .bind(new Date().toISOString(), titleId).run();

// Cron: Only check recently viewed titles
const activeThreshold = new Date();
activeThreshold.setDate(activeThreshold.getDate() - 7); // Last 7 days

const activeTitles = await db.prepare(`
  SELECT * FROM titles
  WHERE last_viewed >= ?
  ORDER BY last_viewed DESC
`).bind(activeThreshold.toISOString()).all();
```

**Pros:**
- ✅ Dramatically reduces API calls (only active titles)
- ✅ Fresher data for titles users actually care about
- ✅ Scales better (abandoned titles don't get checked)

**Cons:**
- ⚠️ Inactive titles become stale
- ⚠️ Requires tracking user views
- ⚠️ Cold start issue (first view = stale data)

**API Calls:** Proportional to active usage (could be 10-20% of total titles)

---

### Strategy 3: Check on Demand with Caching

**Approach:** Check availability when user views title, cache for 24 hours

**Implementation:**
```typescript
// When user views title
export async function getTitleWithFreshData(titleId: number, env: Env) {
  const title = await getTitleById(env.DB, titleId);

  // Check if data is stale (> 24 hours old)
  const latestCheck = await db.prepare(`
    SELECT MAX(check_date) as latest FROM availability_logs WHERE title_id = ?
  `).bind(titleId).first();

  const dayAgo = new Date();
  dayAgo.setDate(dayAgo.getDate() - 1);

  if (!latestCheck || new Date(latestCheck.latest) < dayAgo) {
    // Data is stale, refresh it
    const availability = await getTitleAvailability(...);
    await logAvailability(...);
  }

  return getTitleWithCurrentAvailability(titleId, env.DB);
}
```

**Pros:**
- ✅ Freshest data when user needs it
- ✅ No wasted API calls on unused titles
- ✅ No cron job needed (on-demand)

**Cons:**
- ⚠️ User experiences delay on first view
- ⚠️ Unpredictable API usage patterns
- ⚠️ Could spike if many users view at once

**API Calls:** Proportional to page views (1 call per title per 24 hours per viewer)

---

### Strategy 4: Batch Processing with Priority Queue

**Approach:** Check high-priority titles more frequently

**Implementation:**
```typescript
// Add priority column to titles
ALTER TABLE titles ADD COLUMN check_priority INTEGER DEFAULT 1;

// Cron runs every hour
export async function handleScheduled(env: Env): Promise<void> {
  // Get titles sorted by priority and last check time
  const titles = await db.prepare(`
    SELECT t.*, MAX(al.check_date) as last_checked
    FROM titles t
    LEFT JOIN availability_logs al ON t.id = al.title_id
    GROUP BY t.id
    ORDER BY
      t.check_priority DESC,  -- High priority first
      last_checked ASC         -- Oldest checks first
    LIMIT 100  -- Check max 100 titles per hour
  `).all();

  for (const title of titles.results) {
    await checkAndLogAvailability(title);
    await delay(1000); // 1 second between requests
  }
}

// Increase priority when user views title
await db.prepare('UPDATE titles SET check_priority = check_priority + 1 WHERE id = ?')
  .bind(titleId).run();

// Decay priority over time (in another cron job)
await db.prepare('UPDATE titles SET check_priority = GREATEST(1, check_priority - 1)')
  .run();
```

**Pros:**
- ✅ Popular titles get fresher data
- ✅ Predictable API usage (100/hour = 2400/day max)
- ✅ Fair distribution over time
- ✅ Adapts to usage patterns

**Cons:**
- ⚠️ More complex implementation
- ⚠️ Requires priority decay job
- ⚠️ Unpopular titles could get very stale

**API Calls:** Fixed maximum (e.g., 100/hour = 2400/day)

---

### Strategy 5: User-Based Rate Limiting with Auth

**Approach:** Limit titles per user, check only authenticated users' titles

**Implementation:**
```typescript
// After adding auth:
// 1. Limit users to 50 titles max
const userTitleCount = await db.prepare(
  'SELECT COUNT(*) as count FROM titles WHERE user_id = ?'
).bind(userId).first();

if (userTitleCount.count >= 50) {
  return { error: 'Maximum 50 titles per user' };
}

// 2. Only check titles for active users
const activeUsers = await db.prepare(`
  SELECT DISTINCT user_id FROM users
  WHERE last_login >= ?
`).bind(sevenDaysAgo).all();

for (const userId of activeUsers) {
  const userTitles = await getTitlesByUser(userId);
  // Check each user's titles...
}
```

**Pros:**
- ✅ Clear limits per user (prevents abuse)
- ✅ Only check active users' titles
- ✅ Scalable with user-based pricing later
- ✅ Fair usage across users

**Cons:**
- ⚠️ Requires authentication first
- ⚠️ Need to migrate data model
- ⚠️ More complex user management

**API Calls:** (Active users × 50 titles × check frequency)

---

## Recommended Implementation

### Phase 1: Immediate (No Auth) - **Strategy 1: Spread Throughout Day**

```typescript
// wrangler.toml
[triggers]
crons = [
  "0 */4 * * *"  // Every 4 hours (6 times per day)
]

// scheduled.ts
export async function handleScheduled(env: Env): Promise<void> {
  const titles = await getAllTitles(env.DB);

  // Determine which subset to check (divide into 6 groups for 4-hour intervals)
  const hour = new Date().getUTCHours();
  const batch = Math.floor(hour / 4); // 0-5
  const titlesPerBatch = Math.ceil(titles.length / 6);

  const startIdx = batch * titlesPerBatch;
  const endIdx = Math.min(startIdx + titlesPerBatch, titles.length);
  const batchTitles = titles.slice(startIdx, endIdx);

  console.log(`Batch ${batch}: Checking ${batchTitles.length} of ${titles.length} titles`);

  for (const title of batchTitles) {
    try {
      if (!title.justwatch_id) continue;

      const availability = await getTitleAvailability(
        parseInt(title.justwatch_id, 10),
        title.type,
        title.name
      );

      // Log availability...
      await logAvailability(env.DB, title.id, ...);

      // Delay between requests (500ms = 7200 requests/hour max)
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error checking ${title.name}:`, error);
    }
  }

  console.log(`Batch ${batch} complete`);
}
```

**Impact:**
- Current: 1 batch of N titles at 6am (N API calls in ~N×0.2 seconds)
- New: 6 batches of N/6 titles every 4 hours (same N API calls, spread over 24 hours)
- API call rate: ~0.5 calls/second instead of 5 calls/second

---

### Phase 2: With Auth - **Strategy 5: User-Based Limits**

```typescript
// 1. Limit watchlist size
const MAX_TITLES_PER_USER = 50;

// 2. Check active users only
const INACTIVE_THRESHOLD_DAYS = 30;

// 3. User-based batching
export async function handleScheduled(env: Env): Promise<void> {
  // Get active users
  const activeUsers = await getActiveUsers(env.DB, INACTIVE_THRESHOLD_DAYS);

  for (const user of activeUsers) {
    const userTitles = await getTitlesByUser(env.DB, user.id);

    for (const title of userTitles) {
      await checkAndLogAvailability(title, env);
      await delay(500);
    }
  }
}
```

---

## Additional Protections

### 1. Implement Exponential Backoff

```typescript
async function checkWithRetry(title: Title, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await getTitleAvailability(...);
    } catch (error) {
      if (error.status === 429) { // Rate limited
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

### 2. Add Request Throttling

```typescript
// Limit concurrent requests
const pLimit = (concurrency: number) => {
  // Queue-based limiting...
};

const limit = pLimit(2); // Max 2 concurrent requests

await Promise.all(
  titles.map(title => limit(() => checkAndLogAvailability(title)))
);
```

### 3. Monitoring & Alerts

```typescript
// Track API success/failure rate
let successCount = 0;
let failureCount = 0;

// If failure rate > 10%, back off
if (failureCount / (successCount + failureCount) > 0.1) {
  console.warn('High failure rate, backing off...');
  await delay(5000);
}
```

---

## Decision Matrix

| Strategy | API Calls/Day | Freshness | Complexity | Scales | Auth Required |
|----------|---------------|-----------|------------|--------|---------------|
| **1. Spread Throughout Day** | N | 24hr | Low | Medium | No |
| **2. User Activity** | 10-20% of N | 24hr | Medium | Good | Maybe |
| **3. On-Demand + Cache** | ~N | <24hr | Medium | Good | No |
| **4. Priority Queue** | Fixed (2400) | Varies | High | Excellent | No |
| **5. User-Based** | ActiveUsers×50 | 24hr | High | Excellent | Yes |

---

## Implementation Timeline

**Week 1: Quick Win**
- ✅ Implement Strategy 1 (Spread throughout day)
- Change cron from daily to every 4 hours
- Add batching logic

**Week 2-3: Add Auth (see AUTH-RESEARCH.md)**
- Set up Supabase Auth
- Add user_id to titles table
- Migrate to user-based model

**Week 4: User-Based Rate Limiting**
- Implement Strategy 5
- Add 50 title limit per user
- Only check active users

---

## Public Launch Considerations

### Option A: Keep Free (with limits)
- ✅ Max 50 titles per user
- ✅ Require authentication
- ✅ Pause inactive users (30 days)
- ⚠️ Could still hit limits with many users

### Option B: Freemium Model
- ✅ Free: 10 titles, weekly checks
- 💰 Paid: 100 titles, daily checks, priority updates
- ✅ Sustainable long-term

### Option C: Invite-Only Beta
- ✅ Limited user base during development
- ✅ Monitor API usage
- ✅ Scale gradually

**Recommendation:** Start with Option C (invite-only), then A (free with limits), then B (freemium) if needed.

---

## Next Steps

1. **Immediate:** Implement Strategy 1 (spread checks throughout day)
2. **Soon:** Add authentication (required for user limits)
3. **Before Public:** Implement user-based limits + monitoring
4. **Long-term:** Consider freemium or paid tiers

**Code Changes Needed:**
- [ ] Update `wrangler.toml` cron schedule
- [ ] Modify `scheduled.ts` to batch titles
- [ ] Add more delay between requests (200ms → 500ms)
- [ ] Add retry logic with exponential backoff
- [ ] Monitor API failure rates
