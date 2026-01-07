# TV Streaming Availability Tracker

Track streaming availability history of movies and TV shows to make informed purchasing decisions.

## Features

- **Watchlist Management**: Import movies/TV shows by name, resolved via JustWatch
- **Availability Timeline**: Gantt-style visualization of which services had each title
- **Service Analytics**: Compare coverage percentages across Netflix, Hulu, Disney+, etc.
- **Buy Recommendations**: Surface titles rarely available for streaming

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
└── TESTS.md      # Browser test scenarios for automated testing
```

## Quick Start

### 1. Deploy Backend

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create streamtrack
# Copy the database_id to wrangler.toml
npx wrangler d1 execute streamtrack --remote --file=./schema.sql
npx wrangler deploy
```

### 2. Configure Frontend

Update `frontend/src/config.ts` with your Worker URL:
```ts
export const API_URL = 'https://your-worker.workers.dev';
```

### 3. Deploy Frontend

Push to GitHub with Pages enabled, or run locally:
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

1. **Import**: User adds titles → Worker searches JustWatch → stores in D1
2. **Daily Check**: Cron trigger (6am UTC) fetches availability for all titles
3. **History**: Each check logs `{title, service, date, available}` rows
4. **Analytics**: Aggregates logs to calculate coverage % per service over time

## Development

See [CLAUDE.md](./CLAUDE.md) for AI-assisted development workflow, including:
- CLI tools for API testing (curl, wrangler)
- Browser MCP tool for end-to-end testing
- Automated test scenarios in [TESTS.md](./TESTS.md)

```bash
# Local worker development
cd worker && npx wrangler dev

# Local frontend development
cd frontend && npm run dev
```

## License

MIT
