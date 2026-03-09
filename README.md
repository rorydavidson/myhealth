# Health Dashboard

A privacy-first health data visualization and AI insights app. All health data stays on your device — the server handles only authentication and proxies LLM requests.

**Phase 1** — Web app (React SPA, complete)
**Phase 2** — Native iOS app (Swift / SwiftUI, in progress — Milestones 12–14 complete)

---

## Table of Contents

- [Features](#features)
- [Privacy Architecture](#privacy-architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
  - [Web app](#web-app-local-development)
  - [iOS app](#ios-app)
- [Deployment](#deployment-production)
  - [Option A — Standard production](#option-a--standard-production-docker-composeprodym)
  - [Option B — nginx-proxy-manager](#option-b--nginx-proxy-manager-docker-composenpmyml)
  - [Running database migrations](#running-database-migrations-both-options)
- [Environment Variables](#environment-variables-full-reference)
- [Admin Dashboard](#admin-dashboard)
- [Security](#security)
- [Project Structure](#project-structure)
- [Available Commands](#available-commands)
- [Testing](#testing)
- [Clinical Standards](#clinical-standards)
- [iOS App Status](#ios-app-status)
- [License](#license)

---

## Features

Available on both the web app (Phase 1) and native iOS app (Phase 2) unless noted.

### Data Import
- **Apple Health** — Upload your Apple Health XML export (ZIP). Parsed entirely in-browser via Web Workers — files up to 2 GB supported. *(Web)*
- **Apple Health via HealthKit** — Direct, real-time read from HealthKit; no manual export needed. Initial load covers the past 5 years; observer queries keep data current as new workouts and readings are recorded. *(iOS — continuous sync with background delivery)*
- **Google Health Connect** — Upload a JSON export. Parsed client-side. *(Web)*
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
- **Client-side PDF text extraction** using pdfjs-dist via a Vite-bundled Web Worker — no data sent to a server
- **Automatic test-date detection** from the extracted text: supports ISO dates (YYYY-MM-DD), European dates (DD/MM/YYYY), and written month names in French and English
- Detected dates are shown with a "Detected from PDF" badge and can be edited at any time from the detail view
- Results listed most-recent-first by test date
- Structured value extraction with per-test LOINC code auto-assignment
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
- Searches both SNOMED CT substance hierarchy and hypersensitivity condition hierarchy
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
- **Patient profile**: name (required), date of birth, and biological sex (both optional) — entered at export time, never stored on the server
- **Accurate observation dates**: each FHIR `Observation` in the Vital Signs section is timestamped with the actual measurement date

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

### Shared / Backend

| Layer | Technology |
|-------|-----------|
| Backend | Fastify 5, TypeScript |
| ORM | Drizzle ORM |
| Database | PostgreSQL 17 (auth/prefs only) |
| Auth | Better Auth (magic link) |
| LLM | Anthropic Claude API |
| Clinical codes | LOINC (primary), SNOMED CT (supplementary) |
| Monorepo | Turborepo + pnpm workspaces |
| Container runtime | Docker + nginx |

### Web App (Phase 1)

| Layer | Technology |
|-------|-----------|
| Framework | React 19, TypeScript, Vite 6 |
| Routing | TanStack Router (file-based) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts (lazy-loaded) |
| Client storage | Dexie.js (IndexedDB) |
| i18n | react-i18next (English + French) |
| FHIR | HL7 FHIR R4 (`@types/fhir`) |
| PDF generation | pdfmake (client-side) |
| PDF parsing | pdfjs-dist (client-side) |
| Linting/formatting | Biome |
| Testing | Vitest + happy-dom |

### iOS App (Phase 2)

| Layer | Technology |
|-------|-----------|
| Language | Swift 6 (strict concurrency) |
| UI framework | SwiftUI (iOS 17+) |
| Health data | HealthKit (native — no manual export) |
| Local storage | Swift Data |
| Charts | Swift Charts |
| Networking | URLSession + async/await |
| i18n | String Catalogs (`Localizable.xcstrings`, EN + FR) |
| PDF generation | PDFKit (client-side) |
| PDF parsing | PDFKit (`PDFDocument`) |
| FHIR | Custom Swift structs (Codable, mirrors Phase 1 types) |
| Project config | XcodeGen (`project.yml`) |
| Linting | SwiftLint |
| Testing | XCTest |

---

## Quick Start

### Prerequisites

**Web app**
- **Node.js** 22+
- **pnpm** 10+ (`corepack enable` to activate)
- **Docker** (for PostgreSQL in local development)

**iOS app**
- **Xcode** 15.0+ (for String Catalogs and Swift Data)
- **Swift** 6 (bundled with Xcode 15+)
- **iOS** 17.0+ device or simulator
- A running instance of the server (local or production) for auth and LLM proxy

### Web app (local development)

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

In local dev, magic links are printed to the server console — no email service required.

### iOS app

1. Start the server (web quick start steps 1–5 above, or point at a deployed instance)
2. Open `apps/ios/HealthDashboard.xcodeproj` in Xcode
3. In Xcode, open **Signing & Capabilities** for the `HealthDashboard` target and set your development team — required for the HealthKit entitlement
4. Set the server URL in `apps/ios/HealthDashboard/Core/API/APIClient.swift` if your server is not at `http://localhost:3001`
5. Select a real iPhone as the run destination (HealthKit is **not** available in the Simulator)
6. Build and run (`⌘R`)

> **Note:** HealthKit authorization requires the app to be signed with a provisioning profile that includes the HealthKit capability. Xcode manages this automatically with a valid development team.

---

## Deployment (Production)

The app ships as two Docker images:

| Image | Description |
|-------|-------------|
| `apps/server` | Multi-stage Node.js build — Fastify API (auth, preferences, LLM proxy) |
| `apps/web` | Multi-stage Vite build served by nginx — the React SPA |

Two compose files are provided — pick the one that matches your infrastructure:

| File | Use when… |
|------|-----------|
| `docker-compose.prod.yml` | You manage your own reverse proxy / TLS termination separately |
| `docker-compose.npm.yml` | You are running **nginx-proxy-manager** on the same Docker host |

### Option A — Standard production (`docker-compose.prod.yml`)

#### 1. Configure environment variables

```bash
cp .env.example .env
# Edit .env — fill in all required values
```

Required:

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | PostgreSQL password (choose a strong random value) |
| `BETTER_AUTH_SECRET` | Session secret — generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public URL of the app (e.g. `https://health.example.com`) |
| `CORS_ORIGIN` | Same as `BETTER_AUTH_URL` |
| `ANTHROPIC_API_KEY` | Anthropic API key for LLM insights |

Optional:

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `health` | PostgreSQL user |
| `POSTGRES_DB` | `health` | PostgreSQL database name |
| `LOG_LEVEL` | `info` | Fastify log level |
| `WEB_PORT` | `80` | Host port for the nginx container |
| `SERVER_PORT` | `3001` | Host port for the API server container |
| `RESEND_API_KEY` | — | For magic-link email delivery (omit to log links to the console) |
| `RESEND_FROM` | — | Sender address (must match a verified Resend domain) |
| `ADMIN_EMAIL` | — | Email address for the [admin dashboard](#admin-dashboard) |
| `TURNSTILE_SECRET_KEY` | — | Cloudflare Turnstile secret — see [Security](#security) |
| `VITE_TURNSTILE_SITE_KEY` | — | Cloudflare Turnstile site key (build-time) |
| `VITE_FHIR_TERMINOLOGY_URL` | `https://browser.ihtsdotools.org/fhir` | SNOMED CT terminology server |

#### 2. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f
```

---

### Option B — nginx-proxy-manager (`docker-compose.npm.yml`)

Recommended when nginx-proxy-manager (NPM) is already running on the same host. No ports are published — NPM routes traffic to the `web` container through a shared Docker network. The API server is never directly exposed; the nginx inside `web` proxies `/api/` to `server:3001` on an internal network.

#### Architecture

```
Internet
  └── nginx-proxy-manager (proxy network, TLS termination)
        └── web:80  (nginx — serves SPA, proxies /api/ internally)
              └── server:3001  (Fastify — internal network only)
                    └── postgres:5432  (internal network only, no published ports)
```

#### 1. Create the shared proxy network (once per host)

```bash
docker network create proxy
```

> Skip this if the network already exists (NPM usually creates it on first run).

#### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env
```

Required:

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Strong random password |
| `BETTER_AUTH_SECRET` | Session secret — `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public URL, e.g. `https://health.example.com` |
| `CORS_ORIGIN` | Same as `BETTER_AUTH_URL` |
| `ANTHROPIC_API_KEY` | Anthropic API key |

Optional: same table as Option A above.

#### 3. Build and start

```bash
docker compose -f docker-compose.npm.yml up -d --build
```

#### 4. Add a Proxy Host in NPM

In the NPM web UI, create a new **Proxy Host**:

| Field | Value |
|-------|-------|
| Domain Names | `health.example.com` (your domain) |
| Forward Hostname / IP | `web` |
| Forward Port | `80` |
| SSL | Enable — Let's Encrypt, force HTTPS |
| Websockets | Off |

NPM resolves `web` via the shared `proxy` Docker network.

---

### Running database migrations (both options)

Migrations run automatically at server startup. To run them manually:

```bash
# Standard
docker compose -f docker-compose.prod.yml exec server \
  node -e "import('@health-app/db').then(m => m.runMigrations())"

# NPM
docker compose -f docker-compose.npm.yml exec server \
  node -e "import('@health-app/db').then(m => m.runMigrations())"
```

Or run migrations locally against the production database URL:

```bash
DATABASE_URL=<prod-url> pnpm --filter @health-app/db db:migrate
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
| `BETTER_AUTH_URL` | `http://localhost:5173` | ✅ |
| `CORS_ORIGIN` | `http://localhost:5173` | ✅ |
| `ANTHROPIC_API_KEY` | — | ✅ (for LLM insights) |
| `RESEND_API_KEY` | — | Recommended (magic links print to console if unset) |
| `RESEND_FROM` | — | Required when `RESEND_API_KEY` is set |
| `ADMIN_EMAIL` | — | Optional — enables the admin dashboard |
| `TURNSTILE_SECRET_KEY` | — | Optional — enables server-side Turnstile verification |
| `VITE_TURNSTILE_SITE_KEY` | — | Optional — enables the Turnstile widget on the login form |
| `PORT` | `3001` | — |
| `HOST` | `0.0.0.0` | — |
| `LOG_LEVEL` | `info` | — |
| `VITE_FHIR_TERMINOLOGY_URL` | `https://browser.ihtsdotools.org/fhir` | — |
| `VITE_API_URL` | `http://localhost:3001` | ✅ |

> **`BETTER_AUTH_URL`** must be set to the **public-facing web URL** (e.g. `https://health.example.com`) so that magic link emails contain the correct origin. In Docker Compose local dev it defaults to `http://localhost:5173`.

---

## Admin Dashboard

The admin dashboard at `/admin` provides an overview of your deployment. Access is restricted to the email address set in `ADMIN_EMAIL` — authentication uses the same magic link flow as regular users.

### What's shown

**Overview** — user metrics:
- Total registered users, verified vs. unverified emails
- New users in the last 7 and 30 days
- Active (non-expired) session count

**System** — server resource usage:
- PostgreSQL database size
- Node.js heap memory (used / total) and RSS
- Process CPU usage (sampled) and system load average
- Process uptime

**User accounts** — all accounts with PII masked server-side:
- Masked email and name, verification status, join date, last seen, active session count
- The admin account is highlighted with a shield badge and cannot be deleted
- Delete any other account (with confirmation step) — cascades to sessions, preferences, and verification records

### Enabling the admin dashboard

```bash
# .env
ADMIN_EMAIL=you@example.com
```

If `ADMIN_EMAIL` is unset, all `/api/admin/*` endpoints return `503` and the dashboard is effectively disabled.

---

## Security

### Rate limiting

All API endpoints are rate-limited via `@fastify/rate-limit`:

| Scope | Limit | Notes |
|-------|-------|-------|
| Global | 100 req / min / IP | Applied to all routes |
| Auth (`/api/auth/*`) | 10 req / min / IP | Tighter limit to protect magic link sending |
| LLM (`/api/llm/query`) | 20 req / min / user | Keyed by session user ID to prevent IP-rotation bypass |

Responses over the limit receive a `429 Too Many Requests` with a `Retry-After` header.

### HTTP security headers

`@fastify/helmet` sets standard security headers on all API responses (HSTS, X-Content-Type-Options, X-Frame-Options, etc.). CSP is intentionally relaxed — the frontend handles its own CSP via nginx.

### Back-pressure

`@fastify/under-pressure` automatically returns `503 Service Unavailable` when:
- Event loop lag exceeds **1 second**
- Heap memory exceeds **400 MB**

This prevents the server from accepting new requests when it is already overloaded.

### Cloudflare Turnstile (optional)

A bot challenge can be added to the login form using [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/). When enabled, the client must solve a challenge before a magic link is sent. Both keys are required to activate it.

```bash
# .env
TURNSTILE_SECRET_KEY=<your-secret-key>      # server-side verification
VITE_TURNSTILE_SITE_KEY=<your-site-key>     # client-side widget (build-time)
```

Turnstile is fully optional — omitting both keys disables all Turnstile behaviour with no functional impact.

---

## Project Structure

```
health-app/
├── apps/
│   ├── server/                        # Fastify API — auth, preferences, LLM proxy
│   │   └── Dockerfile                 # Multi-stage production build
│   ├── web/                           # React SPA — all health data lives here (Phase 1)
│   │   ├── Dockerfile                 # Multi-stage Vite build → nginx
│   │   ├── nginx.conf                 # nginx config (SPA fallback, gzip, caching, security headers)
│   │   └── scripts/
│   │       └── check-i18n.ts          # CI script — verifies all locale files are complete
│   └── ios/                           # Native Swift iOS app (Phase 2)
│       ├── HealthDashboard.xcodeproj  # Xcode project (generated via XcodeGen)
│       ├── project.yml                # XcodeGen spec — source of truth for project settings
│       ├── .swiftlint.yml             # SwiftLint configuration
│       └── HealthDashboard/
│           ├── App/                   # @main entry point, tab bar, root view
│           ├── AppState.swift         # @Observable app-wide state (session, HealthKit status)
│           ├── Core/
│           │   ├── API/               # URLSession client, endpoints, error types
│           │   ├── Aggregation/       # Daily summary computation (AggregationService actor)
│           │   ├── Auth/              # Session management, Keychain storage
│           │   ├── HealthKit/         # HKHealthStore wrappers, sync service, type mapping
│           │   ├── Preferences/       # User preferences sync with server
│           │   └── Storage/           # Swift Data schema (@Model classes, PersistenceController)
│           ├── Components/            # Reusable SwiftUI views (MetricCard, SkeletonView, …)
│           ├── Design/                # DesignTokens, MetricCategory colours
│           ├── Features/              # Screen-level views (Dashboard, Import, Auth, …)
│           └── Resources/
│               ├── Localizable.xcstrings  # String Catalog — EN + FR
│               └── Info.plist
├── packages/
│   ├── shared/              # Types, schemas, clinical coding constants (LOINC, SNOMED CT)
│   └── db/                  # Drizzle ORM schema and migrations (auth/prefs only)
├── docker-compose.yml       # Local dev: PostgreSQL + server + web
├── docker-compose.prod.yml  # Production: postgres + server + web (nginx)
├── docker-compose.npm.yml   # Production (nginx-proxy-manager): no published ports
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
pnpm test:e2e     # Run end-to-end tests (Playwright)
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
pnpm --filter @health-app/db db:generate    # Generate migration from schema changes
pnpm --filter @health-app/db db:migrate     # Apply pending migrations

# Tests per package
pnpm --filter @health-app/shared test
pnpm --filter @health-app/web test

# Web app only
pnpm --filter @health-app/web dev        # Vite dev server only
pnpm --filter @health-app/web build      # Production build
pnpm --filter @health-app/web preview    # Preview production build locally
```

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

Unit tests for the iOS app live in `apps/ios/HealthDashboardTests/`:

- **`NormalizeTests.swift`** — HealthKit → `HealthRecord` normalisation (unit conversions, type mapping, sleep grouping)
- **`AggregationTests.swift`** — `AggregationService` daily summary computation (grouped averages, incremental recompute)
- **`LLMPromptTests.swift`** — On-device prompt construction; verifies no PII in Standard mode, no sub-daily timestamps, correct Enhanced mode gating
- **`IPSBundleTests.swift`** — FHIR Bundle structure (all 5 IPS section LOINC codes present, `type == "document"`, `urn:uuid:` fullUrls)

```bash
xcodebuild test \
  -project apps/ios/HealthDashboard.xcodeproj \
  -scheme HealthDashboard \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

---

## Clinical Standards

Health metrics are tagged with standardised clinical codes for interoperability:

- **LOINC** — Primary coding for all observations (vital signs, lab results). Aligns with IPS requirements.
- **SNOMED CT** — Supplementary coding for richer clinical semantics.
- Codes are stored in a static lookup table in `packages/shared/src/coding/` — not per-record in IndexedDB.
- Lab result structured values carry per-test LOINC codes (e.g. HDL → LOINC 2085-9).
- SNOMED CT concept search uses the FHIR ValueSet `$expand` operation against a configurable terminology server (default: SNOMED International public endpoint).

---

## iOS App Status

The iOS app is under active development. Completed milestones:

| Milestone | Status | Description |
|-----------|--------|-------------|
| 12 — Foundation | ✅ Complete | Xcode project, Swift Data schema, API client, design system |
| 13 — Authentication | ✅ Complete | Login / sign-up / forgot password, session persistence, user preferences |
| 14 — HealthKit & Background Sync | ✅ Complete | Initial 5-year data load, live observer queries, background delivery, workout & sleep handling |
| 15 — Dashboard | 🔜 Planned | SwiftUI dashboard with Swift Charts — mirrors Phase 1 web dashboard |
| 16 — Trends | 🔜 Planned | Weekly comparisons, correlation explorer |
| 17 — Lab Results | 🔜 Planned | PDF import, PDFKit extraction, timeline charts |
| 18 — Conditions / Medications / Allergies | 🔜 Planned | Clinical data entry with SNOMED CT search |
| 19 — LLM Insights | 🔜 Planned | On-device prompt construction, streaming SSE, privacy tiers |
| 20 — IPS Export | 🔜 Planned | FHIR R4 IPS Bundle generation, PDF export |
| 21–24 — Portability, Import, Settings, Polish | 🔜 Planned | Backup/restore, onboarding, App Store readiness |

---

## License

[MIT](LICENSE)
