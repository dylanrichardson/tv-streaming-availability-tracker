# StreamTrack

Track streaming availability history of your movies and TV shows to make informed purchasing decisions.

## Features

- **Watchlist Management**: Import and track your favorite movies/TV shows
- **Availability Timeline**: See which streaming services had your titles and when
- **Service Analytics**: Compare coverage across Netflix, Hulu, Disney+, etc.
- **Buy Recommendations**: Identify titles rarely available for streaming

## Architecture

- **Frontend**: React + Vite + Tailwind CSS + Recharts (GitHub Pages)
- **Backend**: Cloudflare Workers + D1 Database
- **Data Source**: JustWatch streaming availability

## Project Structure

```
streamtrack/
├── frontend/     # React application
└── worker/       # Cloudflare Worker API
```

## Getting Started

### Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)

### Backend Setup

```bash
cd worker
npm install
wrangler d1 create streamtrack
# Update wrangler.toml with database_id
wrangler d1 execute streamtrack --file=./schema.sql
wrangler dev  # Local development
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev  # Local development
```

## Deployment

### Backend (Cloudflare Workers)

```bash
cd worker
wrangler deploy
```

### Frontend (GitHub Pages)

Push to main branch - GitHub Actions will deploy automatically.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync` | Import titles to track |
| GET | `/api/titles` | List all tracked titles |
| GET | `/api/history/:id` | Get availability timeline |
| GET | `/api/stats/services` | Get service coverage stats |

## License

MIT
