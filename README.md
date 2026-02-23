# Health Dashboard

A privacy-first health data visualization and insights app. All health data stays on your device — the server only handles authentication and proxies LLM requests.

## Prerequisites

- **Node.js** 22+
- **pnpm** 10+ (`corepack enable` to activate)
- **Docker** (for PostgreSQL in local development)

## Quick Start (Local Development)

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment variables and fill in your values
cp .env.example .env

# 3. Start the database
docker compose up -d

# 4. Run database migrations
pnpm --filter @health-app/db db:generate
pnpm --filter @health-app/db db:migrate

# 5. Start everything
pnpm dev
```

The web app will be at **http://localhost:5173** and the API server at **http://localhost:3001**.
Swagger UI (API docs) is at **http://localhost:3001/docs**.

---

## Deployment (Production)

The app ships as two Docker images:

| Image | Description |
|-------|-------------|
| `apps/server` | Multi-stage Node.js build — Fastify API (auth, preferences, LLM proxy) |
| `apps/web` | Multi-stage Vite build served by nginx — the React SPA |

### 1. Configure environment variables

```bash
cp .env.example .env
# Edit .env — fill in all required values (marked with :? in docker-compose.prod.yml)
```

Required production values:

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | PostgreSQL password (choose a strong random value) |
| `BETTER_AUTH_SECRET` | Auth session secret — generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public URL of the server (e.g. `https://api.yourdomain.com`) |
| `CORS_ORIGIN` | Public URL of the web app (e.g. `https://yourdomain.com`) |
| `ANTHROPIC_API_KEY` | Anthropic API key for LLM insights |

Optional:

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `health` | PostgreSQL user |
| `POSTGRES_DB` | `health` | PostgreSQL database name |
| `LOG_LEVEL` | `info` | Fastify log level (`trace`, `debug`, `info`, `warn`, `error`) |
| `WEB_PORT` | `80` | Host port for the nginx container |
| `SERVER_PORT` | `3001` | Host port for the API server container |
| `VITE_FHIR_TERMINOLOGY_URL` | `https://r4.ontoserver.csiro.au/fhir` | FHIR terminology server for SNOMED CT search |
| `VITE_API_URL` | `http://localhost:3001` | API base URL as seen from the browser |

### 2. Build and start containers

```bash
# Build images and start all services (postgres + server + web)
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop
docker compose -f docker-compose.prod.yml down
```

### 3. Run database migrations in production

Migrations must be run once after the first deploy and after any schema changes:

```bash
docker compose -f docker-compose.prod.yml exec server \
  node -e "import('@health-app/db').then(m => m.runMigrations())"
```

Or run migrations locally against the production `DATABASE_URL` before deploying:

```bash
DATABASE_URL=<prod-url> pnpm --filter @health-app/db migrate
```

### Architecture overview

```
Browser (user's device)
  └── Static SPA (nginx)  ──HTTP──▶  API Server (Fastify)  ──▶  PostgreSQL
                                          │                        (auth only)
                                          └──▶  Anthropic API
                                               (LLM proxy — no health data stored)

All health data lives in the browser's IndexedDB. The server never sees it.
```

---

## Environment Variables (full reference)

Create a `.env` file in the monorepo root. See `.env.example` for all variables with descriptions.

| Variable | Local default | Required in production |
|----------|--------------|------------------------|
| `DATABASE_URL` | `postgresql://health:health@localhost:5432/health` | ✅ |
| `POSTGRES_USER` | `health` | — |
| `POSTGRES_PASSWORD` | `health` | ✅ |
| `POSTGRES_DB` | `health` | — |
| `BETTER_AUTH_SECRET` | `dev-secret-change-in-production` | ✅ |
| `BETTER_AUTH_URL` | `http://localhost:3001` | ✅ |
| `CORS_ORIGIN` | `http://localhost:5173` | ✅ |
| `ANTHROPIC_API_KEY` | — | ✅ (for LLM insights) |
| `PORT` | `3001` | — |
| `HOST` | `0.0.0.0` | — |
| `LOG_LEVEL` | `info` | — |
| `VITE_FHIR_TERMINOLOGY_URL` | `https://r4.ontoserver.csiro.au/fhir` | — |
| `VITE_API_URL` | `http://localhost:3001` | ✅ |

---

## Project Structure

```
health-app/
├── apps/
│   ├── server/              # Fastify API — auth, preferences, LLM proxy
│   │   └── Dockerfile       # Multi-stage production build
│   └── web/                 # React SPA — all health data lives here
│       ├── Dockerfile       # Multi-stage Vite build → nginx
│       ├── nginx.conf       # nginx config (SPA fallback, gzip, caching, security headers)
│       └── scripts/
│           └── check-i18n.ts  # CI script — verifies all locale files are complete
├── packages/
│   ├── shared/              # Types, schemas, clinical coding constants (LOINC, SNOMED CT)
│   └── db/                  # Drizzle ORM schema and migrations (auth/prefs only)
├── docker-compose.yml       # Local dev: PostgreSQL only
├── docker-compose.prod.yml  # Production: postgres + server + web (nginx)
├── .env.example             # Template for all environment variables
├── .dockerignore            # Docker build exclusions
└── turbo.json               # Monorepo build pipeline
```

---

## Available Commands

```bash
# Development
pnpm dev          # Start dev servers (web + API, hot reload)
pnpm build        # Build all packages and apps
pnpm typecheck    # TypeScript type-checking across all packages

# Quality
pnpm test         # Run unit tests (Vitest)
pnpm lint         # Lint all packages (Biome)
pnpm format       # Format all packages (Biome)

# i18n
pnpm --filter @health-app/web check:i18n  # Verify all locale keys are present in EN + FR

# Cleanup
pnpm clean        # Remove build artifacts and caches
```

### Package-specific commands

```bash
# Database migrations (server auth DB)
pnpm --filter @health-app/db generate    # Generate migration from schema changes
pnpm --filter @health-app/db migrate     # Apply pending migrations

# Tests per package
pnpm --filter @health-app/shared test
pnpm --filter @health-app/web test

# Web app only
pnpm --filter @health-app/web dev        # Vite dev server only
pnpm --filter @health-app/web build      # Production build
pnpm --filter @health-app/web preview    # Preview production build locally
```

---

## Features

### Data Import
- **Apple Health** — Upload your Apple Health XML export (ZIP). Parsed entirely in-browser via Web Workers — files up to 2 GB supported.
- **Google Health Connect** — Upload a JSON export. Parsed client-side.
- Duplicate detection: re-importing an export skips records that already exist.

### Dashboard
- **Activity**: steps, distance, active energy burned
- **Heart**: heart rate (with min/max range), resting HR, HRV
- **Sleep**: sleep duration
- **Body**: weight, body fat %
- **Vitals**: blood oxygen (SpO₂), blood pressure, respiratory rate
- Interactive charts with date range selection (7d, 30d, 90d, 1y, All)
- Chart components are **lazy-loaded** — Recharts only loads when first needed, keeping the initial bundle small

### Workouts
- Workout history table with type, date, duration, distance, and calories
- Monthly frequency bar chart
- Filter by workout type
- Table rows use `content-visibility: auto` for efficient rendering of large datasets

### Trends
- Weekly comparison cards with trend direction and % change vs. prior week
- Cross-metric correlation explorer (Pearson r) with dual-axis chart

### Lab Results
- Upload PDF lab reports — stored locally as binary blobs (never uploaded)
- Client-side text extraction with LOINC code auto-assignment
- Track lab values over time, filter by category

### Conditions (Problem List)
- Maintain a personal problem list of clinical diagnoses
- Live SNOMED CT concept search via a configurable FHIR terminology server
- Conditions are included in the Patient Summary (IPS) export

### Medications
- Track current and past medications with dosage, frequency, start/end dates
- SNOMED CT–coded substance search
- Medications are included in the Patient Summary (IPS) export

### Allergies & Adverse Reactions
- Record allergies and intolerances with type, category, criticality, and reaction details
- Searches both SNOMED CT substance hierarchy **and** hypersensitivity condition hierarchy (so "Hay fever", "Penicillin allergy" etc. are found)
- Allergies are included in the Patient Summary (IPS) export

### LLM Insights
- Chat with AI about your health data
- **Standard mode** (default): Only anonymised, pre-aggregated summaries sent — no raw records leave your device
- **Enhanced mode** (per-query opt-in): Include specific lab values or detailed metrics with explicit consent and full data preview before sending
- Never sent in any mode: PII, device identifiers, sub-daily timestamps

### Patient Summary (IPS)
- Generate an **International Patient Summary** (HL7 FHIR R4 — ISO/EN 27269)
- Includes all five required IPS sections: Vital Signs, Lab Results, Medication Summary, Allergies & Intolerances, Problem List
- Export as **FHIR JSON** (machine-readable, for EHR import) or **PDF** (human-readable, for sharing with providers)
- All generation happens entirely client-side — the FHIR bundle never touches the server
- Patient name is entered at export time and is not stored

### Data Portability
- Export all data as a full-fidelity JSON backup (includes lab PDF blobs as base64)
- Re-import a backup to restore your complete history in a fresh browser
- Storage usage monitoring in settings
- Clear all data from settings (with confirmation warning)

### Privacy & Help Pages
- `/privacy` — Privacy policy explaining the local-first architecture
- `/help` — FAQ covering import, privacy, data management, and AI insights

---

## Privacy Architecture

Health data **never leaves your device**:

- All parsing, storage, and aggregation runs in the browser (IndexedDB via Dexie.js)
- Web Workers handle heavy parsing (Apple Health XML, PDF text extraction) without blocking the UI
- The server stores only user accounts and preferences — **zero health data**
- LLM queries send only client-computed summaries (e.g. "7-day step average: 8,200"), never raw records or PII
- Data export is a client-side operation — the server is not involved
- Clearing browser site data permanently deletes all health records

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 19, TypeScript, Vite 6 |
| Routing | TanStack Router (file-based) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts (lazy-loaded) |
| Client storage | Dexie.js (IndexedDB) |
| i18n | react-i18next (English + French) |
| Backend | Fastify 5, TypeScript |
| ORM | Drizzle ORM |
| Database | PostgreSQL 17 (auth/prefs only) |
| Auth | Better Auth |
| LLM | Anthropic Claude API |
| Clinical codes | LOINC (primary), SNOMED CT (supplementary) |
| FHIR | HL7 FHIR R4 (`@types/fhir`) |
| PDF generation | pdfmake (client-side) |
| PDF parsing | pdfjs-dist (client-side) |
| Monorepo | Turborepo + pnpm workspaces |
| Linting/formatting | Biome |
| Testing | Vitest + happy-dom |
| Container runtime | Docker + nginx |

---

## Testing

Unit tests live in `apps/web/src/services/__tests__/` and cover:

- **`normalize.test.ts`** — Apple Health and Health Connect data normalisation (unit conversions, type mapping, ID generation)
- **`aggregate.test.ts`** — Daily summary aggregation logic (grouping, stats computation, merging)
- **`llm.test.ts`** — LLM context formatting and privacy constraints (no raw records, no sub-daily timestamps, no PII)
- **`ips.test.ts`** — FHIR Bundle structure validation (all 5 IPS section codes, resource types, Composition structure)

```bash
pnpm --filter @health-app/web test                    # Run all web tests
pnpm --filter @health-app/web check:i18n              # Verify EN + FR locale completeness
pnpm --filter @health-app/shared test                 # Shared package tests
```

---

## Clinical Standards

Health metrics are tagged with standardised clinical codes for interoperability:

- **LOINC** — Primary coding for all observations (vital signs, lab results). Aligns with IPS requirements.
- **SNOMED CT** — Supplementary coding for richer clinical semantics.
- Codes are stored in a static lookup table in `packages/shared/src/coding/` — not per-record in IndexedDB.
- Lab result structured values carry per-test LOINC codes (e.g. HDL → LOINC 2085-9).
- SNOMED CT concept search uses the FHIR ValueSet `$expand` operation against a configurable terminology server (default: Ontoserver CSIRO public endpoint).
