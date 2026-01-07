# Queue System & Shared Database Design

## Problems to Solve

1. **Batching Bug**: Current fixed-batch system breaks when titles are added/removed
2. **Rate Limiting**: Need to check titles less frequently (weekly instead of daily)
3. **Scalability**: With auth, N users × M titles = N×M API calls (doesn't scale)

## Solution: Shared Global Title Database

### Concept

**Current model (with auth):**
- Each user has their own watchlist
- Same title tracked by 100 users = 100 separate checks

**Proposed model (no auth):**
- Single global database of titles
- ANY user can add a title (if not already present)
- Each unique title checked once per week
- All users see the same availability history for each title

**Benefits:**
- ✅ 100 users tracking "Breaking Bad" = 1 API call instead of 100
- ✅ No auth needed (simpler, faster to build)
- ✅ Better for users (more titles = more comprehensive database)
- ✅ Dramatically reduces JustWatch API load

**Tradeoffs:**
- ⚠️ Users can't have "private" watchlists
- ⚠️ No per-user features (notifications, reminders)
- ⚠️ Need spam prevention (rate limit imports per IP?)

---

## Queue System Design

### Database Schema Changes

```sql
-- Add last_checked column to track when title was last updated
ALTER TABLE titles ADD COLUMN last_checked DATETIME;

-- Index for efficient queue queries
CREATE INDEX idx_titles_last_checked ON titles(last_checked);

-- Optional: Add created_at for tracking when title was imported
ALTER TABLE titles ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
```

### Algorithm: Dynamic Queue

**On each cron run (every 4 hours):**

1. **Find stale titles** (haven't been checked in > 7 days OR never checked):
```sql
SELECT * FROM titles
WHERE last_checked IS NULL
   OR last_checked < datetime('now', '-7 days')
ORDER BY last_checked ASC NULLS FIRST
LIMIT ?
```

2. **Determine batch size dynamically**:
```typescript
const CRON_INTERVAL_HOURS = 4;
const TARGET_CHECK_FREQUENCY_DAYS = 7;

// How many cron runs per target period?
const runsPerPeriod = (TARGET_CHECK_FREQUENCY_DAYS * 24) / CRON_INTERVAL_HOURS;
// 7 days * 24 hours / 4 hours = 42 runs per week

// How many titles to check per run?
const totalTitles = await getTitleCount(db);
const titlesPerRun = Math.max(1, Math.ceil(totalTitles / runsPerPeriod));
// e.g., 420 titles / 42 runs = 10 titles per run
```

3. **Check titles and update timestamp**:
```typescript
for (const title of staleTitles) {
  await checkAndLogAvailability(title);
  await updateLastChecked(db, title.id, new Date().toISOString());
  await delay(500); // Rate limiting
}
```

**Key Properties:**
- ✅ New titles get checked immediately (NULL last_checked)
- ✅ Titles checked in order of staleness (fairness)
- ✅ Self-adjusting: more titles = smaller batches, spread over time
- ✅ No skipped titles when database changes
- ✅ Configurable check frequency (weekly, bi-weekly, etc.)

---

## Duplicate Title Detection

### Current Issue
When user imports "The Matrix", we need to:
1. Check if "The Matrix" already exists
2. If yes: show "Already tracked"
3. If no: Add to database

### Implementation

**Already exists:**
```typescript
// database.ts
export async function findTitleByName(db: D1Database, name: string): Promise<Title | null> {
  const result = await db
    .prepare('SELECT * FROM titles WHERE LOWER(name) = LOWER(?)')
    .bind(name)
    .first<Title>();
  return result;
}
```

**In sync endpoint:**
```typescript
// index.ts
for (const titleName of titles) {
  const existing = await findTitleByName(env.DB, titleName);

  if (existing) {
    results.push({
      name: titleName,
      status: 'exists',
      title: existing
    });
    continue;
  }

  // Search JustWatch and create new title...
}
```

**This already works!** ✅

### Edge Cases

**Problem: Slight variations in title names**
- User 1 imports: "The Matrix"
- User 2 imports: "Matrix, The"
- JustWatch returns same ID for both

**Solution: Use JustWatch ID as canonical identifier**
```sql
-- Check for duplicate JustWatch ID before inserting
SELECT * FROM titles WHERE justwatch_id = ?
```

```typescript
export async function findTitleByJustWatchId(
  db: D1Database,
  justwatchId: string
): Promise<Title | null> {
  const result = await db
    .prepare('SELECT * FROM titles WHERE justwatch_id = ?')
    .bind(justwatchId)
    .first<Title>();
  return result;
}

// In sync logic:
const jwTitle = await searchJustWatch(titleName);
const existingById = await findTitleByJustWatchId(env.DB, jwTitle.id);

if (existingById) {
  // Already tracked with different name
  results.push({
    name: titleName,
    status: 'exists',
    title: existingById,
    note: `Already tracked as "${existingById.name}"`
  });
  continue;
}
```

---

## Spam Prevention (Without Auth)

Since anyone can add titles, we need abuse prevention:

### Option 1: IP-based Rate Limiting

```typescript
// Use Cloudflare Workers KV for rate limiting
export async function checkRateLimit(
  env: Env,
  ip: string
): Promise<{ allowed: boolean; limit: number; remaining: number }> {
  const key = `ratelimit:${ip}`;
  const limit = 20; // Max 20 imports per hour

  const current = await env.RATE_LIMIT_KV.get(key);
  const count = current ? parseInt(current) : 0;

  if (count >= limit) {
    return { allowed: false, limit, remaining: 0 };
  }

  await env.RATE_LIMIT_KV.put(
    key,
    String(count + 1),
    { expirationTtl: 3600 } // 1 hour
  );

  return { allowed: true, limit, remaining: limit - count - 1 };
}
```

**Free tier limits:**
- Cloudflare Workers KV: 100,000 reads/day, 1,000 writes/day (free)
- Should be sufficient for rate limiting

### Option 2: Simple Global Limit

```typescript
// Limit imports per request
const MAX_TITLES_PER_REQUEST = 50;

if (titles.length > MAX_TITLES_PER_REQUEST) {
  return new Response(
    JSON.stringify({
      error: `Maximum ${MAX_TITLES_PER_REQUEST} titles per import`
    }),
    { status: 400 }
  );
}
```

---

## Recommended Implementation Order

### Phase 1: Fix Batching Bug (Immediate)
1. Add `last_checked` column to schema
2. Implement queue system in `scheduled.ts`
3. Deploy and verify titles are checked fairly

### Phase 2: Improve Duplicate Detection
1. Add `findTitleByJustWatchId()` function
2. Check both name and JustWatch ID in sync endpoint
3. Show helpful message when duplicate found

### Phase 3: Spam Prevention (Before Public)
1. Add IP-based rate limiting (20 imports/hour)
2. Limit max titles per request (50)
3. Add Cloudflare Workers KV binding

### Phase 4: Monitoring
1. Track total titles in database
2. Monitor API call frequency
3. Alert if JustWatch starts rate limiting

---

## Configuration

All parameters should be configurable:

```typescript
// config.ts
export const CONFIG = {
  // Queue system
  CRON_INTERVAL_HOURS: 4,
  TARGET_CHECK_FREQUENCY_DAYS: 7,

  // Rate limiting
  API_DELAY_MS: 500,
  MAX_RETRIES: 3,
  BACKOFF_MS: 5000,

  // Spam prevention
  MAX_TITLES_PER_REQUEST: 50,
  IMPORTS_PER_HOUR_PER_IP: 20,

  // JustWatch API
  JUSTWATCH_COUNTRY: 'US',
  POSTER_SIZE: 's332',
  POSTER_FORMAT: 'webp',
};
```

---

## Testing Strategy

### Test: Duplicate Detection
```gherkin
Given a title "Breaking Bad" exists in database
When user imports "Breaking Bad"
Then status should be "exists"
And no new title should be created
```

### Test: Queue System Fairness
```gherkin
Given 100 titles in database with no last_checked
When cron runs 42 times (1 week)
Then all 100 titles should have been checked at least once
And each title should have been checked at most twice
```

### Test: Dynamic Batching
```gherkin
Given 10 titles in database
When 90 new titles are imported
And cron runs
Then titles should be selected by last_checked (oldest first)
And batch size should adjust automatically
```

---

## Questions for You

1. **Check frequency**: Weekly (7 days) or bi-weekly (14 days)?
   - Weekly = fresher data but more API calls
   - Bi-weekly = less load on JustWatch

2. **Spam prevention**: IP-based rate limiting or just per-request limits?
   - IP-based = requires KV store but more robust
   - Per-request = simpler but easier to abuse

3. **Shared database branding**: Should we call it something else?
   - "StreamTrack Database" (collaborative)
   - "Title Library" (more neutral)
   - Just keep calling it titles/watchlist?

4. **Future monetization**: If we add auth later for premium features:
   - Free: View any title (shared database)
   - Paid: Notifications when title becomes available on your services
   - Paid: Private watchlists, export data, etc.
