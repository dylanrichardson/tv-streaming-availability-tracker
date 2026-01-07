# Spam Prevention & Import Limits

## Your Concerns

1. **Don't want a million titles** - App is for you + showcase, not a comprehensive database
2. **Don't want to abuse JustWatch** - Respect their unofficial API
3. **IP rate limiting** - Is this the right approach?

## Problem Statement

**Without limits:**
- Anyone can import unlimited titles
- Could grow to thousands of titles (unsustainable API load)
- Bad actors could spam/abuse the service
- JustWatch could rate limit or ban us

**Goal:**
- Keep total titles manageable (hundreds, not millions)
- Allow genuine users to contribute
- Prevent abuse without requiring auth
- Respect JustWatch's API

---

## Recommended Approach: Hybrid Limits

### 1. Hard Cap on Total Titles (Database-Wide)

**Strategy:** Limit total tracked titles in the database

```typescript
// In sync endpoint
const MAX_TOTAL_TITLES = 500; // Configurable

const titleCount = await db.prepare('SELECT COUNT(*) as count FROM titles').first();

if (titleCount.count >= MAX_TOTAL_TITLES) {
  return Response.json({
    error: `Title limit reached (${MAX_TOTAL_TITLES}). This is a personal project with limited capacity.`,
    message: 'Search existing titles instead of importing new ones.'
  }, { status: 429 });
}
```

**Benefits:**
- ✅ Hard limit on JustWatch API load
- ✅ Predictable costs/resources
- ✅ Simple to implement
- ✅ Clear messaging to users

**Tradeoffs:**
- ⚠️ Once limit hit, no new titles can be added
- ⚠️ "First come, first served" - might not be fair
- ⚠️ Could reach limit quickly if popular

**When to raise limit:**
- Monitor actual usage
- If hitting limit with legitimate use, increase to 1000, 2000, etc.
- Can adjust based on JustWatch API tolerance

---

### 2. Per-Request Import Limit

**Strategy:** Limit how many titles can be imported in one request

```typescript
const MAX_TITLES_PER_REQUEST = 50;

if (titleNames.length > MAX_TITLES_PER_REQUEST) {
  return Response.json({
    error: `Maximum ${MAX_TITLES_PER_REQUEST} titles per import`
  }, { status: 400 });
}
```

**Benefits:**
- ✅ Prevents single massive import
- ✅ Simple to implement
- ✅ No state/storage needed

**Tradeoffs:**
- ⚠️ User could make multiple requests
- ⚠️ Doesn't prevent determined abuser

---

### 3. IP-Based Rate Limiting (Optional)

**Strategy:** Limit imports per IP address per time window

```typescript
// Using Cloudflare Workers KV (requires setup)
const IMPORTS_PER_HOUR = 100; // titles, not requests

const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
const key = `ratelimit:${ip}:${hour}`;

const current = await env.RATE_LIMIT_KV.get(key);
const imported = current ? parseInt(current) : 0;

if (imported + titleNames.length > IMPORTS_PER_HOUR) {
  return Response.json({
    error: `Rate limit: ${IMPORTS_PER_HOUR} titles per hour per IP`,
    remaining: Math.max(0, IMPORTS_PER_HOUR - imported)
  }, { status: 429 });
}

// After successful import
await env.RATE_LIMIT_KV.put(
  key,
  String(imported + titleNames.length),
  { expirationTtl: 3600 } // 1 hour
);
```

**Benefits:**
- ✅ Prevents single user from spamming
- ✅ Fair distribution across users
- ✅ Temporary limits (resets every hour)

**Tradeoffs:**
- ⚠️ Requires Cloudflare Workers KV setup (free tier: 1000 writes/day)
- ⚠️ Can be bypassed with VPN/proxies
- ⚠️ Might block legitimate users on shared IPs (office, cafe)
- ⚠️ More complex to implement and debug

---

## Recommended Implementation

### Phase 1: Basic Limits (Implement Now)

**Just 2 simple limits:**

1. **Total title cap**: 500 titles (can increase later)
2. **Per-request limit**: 50 titles per import

**Code:**
```typescript
// src/routes/sync.ts

const MAX_TOTAL_TITLES = 500;
const MAX_TITLES_PER_REQUEST = 50;

export async function handleSync(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as SyncRequest;
    const titleNames = body.titles;

    // Check per-request limit
    if (titleNames.length > MAX_TITLES_PER_REQUEST) {
      return Response.json({
        error: `Maximum ${MAX_TITLES_PER_REQUEST} titles per import request`
      }, { status: 400 });
    }

    // Check total titles limit
    const countResult = await env.DB
      .prepare('SELECT COUNT(*) as count FROM titles')
      .first<{ count: number }>();

    if (countResult && countResult.count >= MAX_TOTAL_TITLES) {
      return Response.json({
        error: `Database capacity reached (${MAX_TOTAL_TITLES} titles)`,
        message: 'This is a personal project with limited capacity. Search existing titles instead.',
        currentCount: countResult.count
      }, { status: 429 });
    }

    // ... rest of import logic
  }
}
```

**Why skip IP rate limiting for now:**
- Adds complexity (KV setup, testing)
- Free KV tier is only 1,000 writes/day (might not be enough)
- Total title cap already prevents abuse
- Can add later if needed

---

### Phase 2: Add IP Rate Limiting (If Needed)

**When to add:**
- If seeing abuse patterns (single IP hammering)
- If total cap being hit too quickly
- If you want to open to public

**Implementation:** See code above in section 3

**Alternative to KV:** Cloudflare Workers Durable Objects (more expensive but more powerful)

---

## UI/UX Considerations

### Show Limits in UI

**In ImportModal.tsx:**
```tsx
<p className="text-gray-400 text-sm mb-4">
  Enter movie or TV show titles (max 50 per import).
  Database capacity: {currentCount}/{MAX_TOTAL_TITLES} titles.
</p>
```

**When limit reached:**
```tsx
{isAtCapacity && (
  <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-4 mb-4">
    <p className="text-yellow-400 text-sm">
      ⚠️ Database at capacity ({MAX_TOTAL_TITLES} titles).
      New imports are temporarily disabled. Search existing titles below.
    </p>
  </div>
)}
```

### Show Title Count on Homepage

Add a badge/stat:
```tsx
<div className="text-center py-4 border-b border-gray-800">
  <div className="text-sm text-gray-400">
    Tracking <span className="text-white font-semibold">{titleCount}</span> of{' '}
    <span className="text-gray-500">{MAX_TOTAL_TITLES}</span> titles
  </div>
</div>
```

---

## Alternative: "Upvoting" System (Future)

Instead of hard limit, allow users to "upvote" titles they care about:

**Concept:**
- Titles with <10 upvotes get checked monthly
- Titles with 10-50 upvotes get checked weekly
- Titles with >50 upvotes get checked daily
- Titles with 0 upvotes for 90 days get archived

**Benefits:**
- Democratic (popular titles get prioritized)
- Self-regulating (unpopular titles naturally drop off)
- Can scale to more titles without hitting API limits

**Tradeoffs:**
- Requires tracking upvotes (new schema)
- More complex queue logic
- Still need some hard limits

---

## Monitoring & Alerts

**Track these metrics:**

```typescript
// Add to /api/stats endpoint
{
  totalTitles: 487,
  titleLimit: 500,
  percentUsed: 97.4,
  titlesAddedToday: 23,
  titlesAddedThisWeek: 156,
  mostRecentImport: '2026-01-07T15:23:45Z'
}
```

**Alert thresholds:**
- 80% capacity: "Consider raising limit"
- 95% capacity: "Limit almost reached"
- 100% capacity: "Imports disabled"

---

## Configuration

Centralize all limits:

```typescript
// worker/src/config.ts
export const CONFIG = {
  // Queue system
  CRON_INTERVAL_HOURS: 4,
  TARGET_CHECK_FREQUENCY_DAYS: 7,

  // Import limits
  MAX_TOTAL_TITLES: 500,
  MAX_TITLES_PER_REQUEST: 50,

  // IP rate limiting (optional)
  ENABLE_IP_RATE_LIMIT: false,
  IP_RATE_LIMIT_PER_HOUR: 100,

  // API delays
  API_DELAY_MS: 500,
  RATE_LIMIT_BACKOFF_MS: 5000,
};
```

---

## Recommendation

**Start with Phase 1 (Basic Limits):**
- 500 total titles (easy to raise later)
- 50 titles per import
- No IP rate limiting (yet)
- Add UI messaging about limits
- Monitor usage for 1-2 weeks

**Why this is sufficient:**
- 500 titles × 1 check/week = ~70 API calls/day (very manageable)
- Total cap prevents runaway growth
- Per-request limit prevents accidental huge imports
- Can always add IP limiting later if seeing abuse

**Increase limit if:**
- Hitting 500 with legitimate use
- No abuse patterns observed
- JustWatch API handling load fine

**Add IP rate limiting if:**
- Seeing single IP spamming
- Want to open to public
- Getting abuse complaints
