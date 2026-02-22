# Health Dashboard

A privacy-first health data visualization and insights app. All health data stays on your device — the server only handles authentication and proxies LLM requests.

## Prerequisites

- **Node.js** 20+
- **pnpm** 10+ (`corepack enable` to activate)
- **Docker** (for PostgreSQL)

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start the database
docker compose up -d

# 3. Run database migrations
pnpm --filter @health-app/db generate
pnpm --filter @health-app/db migrate

# 4. Start everything
pnpm dev
```

The web app will be at **http://localhost:5173** and the API server at **http://localhost:3001**.

## Environment Variables

The server uses sensible defaults for local development. For production, set these:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://health:health@localhost:5432/health` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | — | Required for LLM insights feature |
| `BETTER_AUTH_SECRET` | `dev-secret-change-in-production` | Auth session secret |
| `BETTER_AUTH_URL` | `http://localhost:3001` | Server base URL |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `PORT` | `3001` | Server port |
| `LOG_LEVEL` | `info` | Fastify log level |

Create an `.env` file in `apps/server/` to override any of these locally.

## Project Structure

```
health-app/
├── apps/
│   ├── server/          # Fastify API — auth, preferences, LLM proxy
│   └── web/             # React SPA — all health data lives here
├── packages/
│   ├── shared/          # Types, schemas, clinical coding constants
│   └── db/              # Drizzle ORM schema and migrations
├── docker-compose.yml   # PostgreSQL for auth
└── turbo.json           # Monorepo build pipeline
```

## Available Commands

```bash
pnpm dev          # Start dev servers (web + API)
pnpm build        # Build all packages
pnpm test         # Run unit tests
pnpm lint         # Lint all packages (Biome)
pnpm format       # Format all packages (Biome)
pnpm typecheck    # TypeScript type checking
pnpm clean        # Clean build artifacts
```

### Package-Specific

```bash
# Database migrations
pnpm --filter @health-app/db generate    # Generate migration from schema
pnpm --filter @health-app/db migrate     # Apply migrations

# Run tests for a specific package
pnpm --filter @health-app/shared test
pnpm --filter @health-app/web test
```

## Features

### Data Import
- **Apple Health** — Upload your Apple Health XML export (ZIP). Parsed entirely in-browser via Web Workers.
- **Google Health Connect** — Upload a JSON export. Parsed client-side.

### Dashboard
- Activity (steps, distance, calories), Heart (HR, resting HR, HRV), Sleep, Body (weight, body fat), Vitals (SpO2, BP, respiratory rate), and Workouts
- Interactive charts with date range selection (7d, 30d, 90d, 1y, All)
- Trend analysis and cross-metric correlation explorer

### Lab Results
- Upload PDF lab reports stored locally as binary blobs
- Client-side text extraction with LOINC code auto-assignment
- Track lab values over time

### LLM Insights
- Chat with AI about your health data
- **Standard mode** (default): Only aggregated summaries sent — no raw data leaves your device
- **Enhanced mode** (per-query opt-in): Include detailed data with explicit consent and full preview

### Patient Summary (IPS)
- Generate an International Patient Summary (HL7 FHIR R4)
- Export as FHIR JSON for EHR systems or PDF for sharing with providers
- All generation happens client-side

### Data Portability
- Export all data as JSON (full fidelity backup) or CSV
- Import from a previous JSON backup
- Storage usage monitoring in settings

## Privacy Architecture

Health data **never leaves your device**:

- All parsing, storage, and aggregation happens in the browser (IndexedDB via Dexie.js)
- The server stores only user accounts and preferences — zero health data
- LLM queries send only pre-computed summaries, never raw records or PII
- Data export is a client-side operation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, TanStack Router, Tailwind CSS v4 |
| Charts | Recharts |
| Client Storage | Dexie.js (IndexedDB) |
| Backend | Fastify, TypeScript, Drizzle ORM |
| Database | PostgreSQL (auth only) |
| Auth | Better Auth |
| LLM | Anthropic Claude API |
| i18n | react-i18next (English + French) |
| Monorepo | Turborepo, pnpm |
| Linting | Biome |
| Testing | Vitest |

## API Documentation

When the server is running, Swagger UI is available at **http://localhost:3001/docs**.
