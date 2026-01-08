# TV Streaming Availability Tracker

Track streaming availability history of movies and TV shows to make informed purchasing decisions.

**Shared Database Model**: Anyone can add titles to track. All users see the same availability history for each title. This dramatically reduces API load and creates a collaborative knowledge base.

## Features

- **Tracked Titles**: Import movies/TV shows by name, resolved via JustWatch (shared database, up to 5000 titles)
- **Availability Timeline**: Gantt-style visualization of which services had each title
- **Service Analytics**: Compare coverage percentages across Netflix, Hulu, Disney+, etc.
- **Buy Recommendations**: Surface titles rarely available for streaming
- **Queue System**: Smart scheduling checks each title weekly, spreading API calls throughout the day

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  GitHub Pages   │────▶│  Cloudflare Worker   │────▶│  JustWatch API  │
│  (React SPA)    │     │  (Edge Runtime)      │     │  (Unofficial)   │
└─────────────────┘     └──────────┬───────────┘     └─────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │   Cloudflare D1      │
                        │   (SQLite at Edge)   │
                        └──────────────────────┘
```

## Project Structure

```
streamtrack/
├── frontend/     # React + Vite + Tailwind + Recharts
├── worker/       # Cloudflare Worker + D1 API
├── CLAUDE.md     # Instructions for AI-assisted development
└── README.md     # This file
```

## Deploy Your Own Instance

### Prerequisites

- **Cloudflare account** (free tier works)
- **Node.js 20+**
- **Wrangler CLI**: `npm install -g wrangler`

### Automated Setup

Run the self-serve deployment script:

```bash
./setup.sh
```

This will:
1. Authenticate with Cloudflare
2. Create D1 database
3. Deploy the worker
4. Configure and build the frontend
5. Provide deployment instructions

### Manual Setup

If you prefer manual setup:

**1. Deploy Backend**

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create streamtrack
# Copy the database_id to wrangler.toml
npx wrangler d1 execute streamtrack --remote --file=./schema.sql
npx wrangler deploy
```

**2. Configure Frontend**

Create `frontend/.env.production` with your Worker URL:
```bash
VITE_API_URL=https://your-worker-name.your-subdomain.workers.dev
```

**3. Deploy Frontend**

**Option A: Cloudflare Pages (Recommended)**
```bash
cd frontend
npm install
npm run build
npx wrangler pages deploy dist --project-name=streamtrack
```

**Option B: GitHub Pages**
```bash
# Push to GitHub, enable Pages in repo settings
# Set build command: cd frontend && npm run build
# Set publish directory: frontend/dist
git push origin main
```

**Option C: Local Development**
```bash
cd frontend
npm install
npm run dev
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sync` | Import titles `{titles: string[]}` |
| `GET` | `/api/titles` | List all titles with current availability |
| `GET` | `/api/history/:id` | Availability timeline for a title |
| `GET` | `/api/stats/services` | Service coverage statistics |
| `GET` | `/api/recommendations?months=3` | Titles unavailable for N months |
| `POST` | `/api/trigger-check` | Manually run availability check |

## How It Works

1. **Import**: Anyone adds titles → Worker searches JustWatch → stores in shared D1 database
   - Duplicate detection prevents the same title being added twice
   - Up to 5000 titles total, 50 per import request
2. **Queue System**: Cron trigger (every 4 hours) checks oldest unchecked titles
   - Each title checked once per week (configurable)
   - Smart scheduling: batch size adjusts based on total title count
   - ~714 API calls/day at 5000 titles (~30 calls/hour)
3. **History**: Each check logs `{title, service, date, available}` rows
4. **Analytics**: Aggregates logs to calculate coverage % per service over time

**Shared Database Benefits:**
- 100 users tracking the same title = 1 API call instead of 100
- Scales linearly with unique titles, not user count
- No authentication needed (simpler, faster)

### Queue System Design

The system uses a dynamic queue that:
- Prioritizes titles that haven't been checked or are most stale
- Automatically adjusts batch size based on total title count
- Ensures all titles are checked weekly (configurable frequency)

**Algorithm:**
```typescript
// On each cron run (every 4 hours)
const runsPerWeek = (7 * 24) / 4; // 42 runs
const titlesPerRun = Math.ceil(totalTitles / runsPerWeek);

// Select oldest unchecked titles
SELECT * FROM titles
WHERE last_checked IS NULL OR last_checked < datetime('now', '-7 days')
ORDER BY last_checked ASC NULLS FIRST
LIMIT titlesPerRun
```

**Benefits:**
- New titles get checked immediately (NULL last_checked)
- Fair distribution (oldest titles first)
- Self-adjusting (scales with database size)
- No skipped titles when database changes

### Spam Prevention

To prevent abuse without requiring authentication:

1. **Total title cap**: 5000 titles maximum (configurable)
2. **Per-request limit**: 50 titles per import
3. **Duplicate detection**: Same title can't be added twice (by name or JustWatch ID)

These limits ensure sustainable API usage (~714 calls/day at capacity) while allowing genuine users to contribute.

## Configuration

Key configuration options in `worker/src/config.ts`:

```typescript
export const CONFIG = {
  // Queue system
  CRON_INTERVAL_HOURS: 4,              // How often cron runs
  TARGET_CHECK_FREQUENCY_DAYS: 7,      // Check each title weekly

  // Import limits
  MAX_TOTAL_TITLES: 5000,              // Database capacity
  MAX_TITLES_PER_REQUEST: 50,          // Per-import limit

  // API delays
  API_DELAY_MS: 500,                   // Delay between JustWatch requests
  RATE_LIMIT_BACKOFF_MS: 5000,         // Backoff on rate limits
};
```

## Development

### Local Setup

```bash
# Terminal 1: Start worker locally
cd worker
npx wrangler d1 execute streamtrack --local --file=./schema.sql
npx wrangler dev

# Terminal 2: Start frontend locally
cd frontend
npm run dev

# Terminal 3: Test
curl http://127.0.0.1:8787/api/titles
```

### Deployment Workflow

1. **Test locally**: Run selective tests (see CLAUDE.md)
2. **Deploy worker**: `cd worker && npx wrangler deploy`
3. **Deploy frontend**: `git push origin main` (auto-deploys via GitHub Actions)
4. **Verify production**: Run smoke tests (see CLAUDE.md)

### Monitoring

Use the `monitor-metrics` skill to check system health:

```bash
# Ask Claude to check system health
Claude, please check the app health
```

Or query directly:

```bash
# Database stats
npx wrangler d1 execute streamtrack --remote --command "
  SELECT COUNT(*) as total_titles,
         COUNT(CASE WHEN last_checked IS NULL THEN 1 END) as never_checked,
         COUNT(CASE WHEN last_checked >= datetime('now', '-1 day') THEN 1 END) as checked_24h
  FROM titles"

# View worker logs
cd worker && npx wrangler tail
```

## Future Enhancements

### Title Management
- Search before import (preview JustWatch results)
- Remove title from tracking
- Post-import disambiguation for ambiguous matches

### Authentication (Optional)
If implementing auth for per-user features:
- **Recommended**: Supabase Auth (50K MAU free)
- **Alternative**: Clerk (10K MAU free, great DX)
- See CLAUDE.md for detailed auth provider comparison

## Cost Structure

StreamTrack runs entirely on Cloudflare's free tier:
- **Workers**: 100,000 requests/day
- **D1 Database**: 5 GB storage, 5 million reads/day
- **Cron Triggers**: Free (unlimited)
- **GitHub Pages**: Free (unlimited bandwidth)

**Typical usage**: ~60 API calls/day for 500 titles checked weekly.

## License

MIT
