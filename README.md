# Health Dashboard

A privacy-first health data visualization and insights app. All health data stays on your device — the server only handles authentication and proxies LLM requests.

**Phase 1** — Web app (React SPA, complete)
**Phase 2** — Native iOS app (Swift / SwiftUI, in progress — Milestones 12–14 complete)

---

## Prerequisites

### Web app
- **Node.js** 22+
- **pnpm** 10+ (`corepack enable` to activate)
- **Docker** (for PostgreSQL in local development)

### iOS app
- **Xcode** 15.0+ (for String Catalogs and Swift Data)
- **Swift** 6 (bundled with Xcode 15+)
- **iOS** 17.0+ device or simulator (Swift Data and Swift Charts require iOS 17+)
- A running instance of the server (local or production) for auth and LLM proxy

## Quick Start

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

### iOS app

1. Start the server (web quick start steps 1–5 above, or point at a deployed instance)
2. Open `apps/ios/HealthDashboard.xcodeproj` in Xcode
3. In Xcode, open **Signing & Capabilities** for the `HealthDashboard` target and set your development team — this is required for the HealthKit entitlement
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
| `VITE_FHIR_TERMINOLOGY_URL` | `https://browser.ihtsdotools.org/fhir` | FHIR terminology server for SNOMED CT search |
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
DATABASE_URL=<prod-url> pnpm --filter @health-app/db db:migrate
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
| `VITE_FHIR_TERMINOLOGY_URL` | `https://browser.ihtsdotools.org/fhir` | — |
| `VITE_API_URL` | `http://localhost:3001` | ✅ |

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

## Features

Features are available on both the web app (Phase 1) and native iOS app (Phase 2) unless noted.

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
- **Automatic test-date detection** from the extracted text: supports ISO dates (YYYY-MM-DD), European dates (DD/MM/YYYY), and written month names in French and English; keyword-aware pass first (looks near words like "prélevé", "collected") then a fallback scan over the first 80 lines
- Detected dates are shown with a "Detected from PDF" badge and can be edited at any time from the detail view
- Results listed **most-recent-first** by test date
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
- **Patient profile**: name (required), date of birth, and biological sex (both optional) — all entered at export time and never stored on the server
- **Accurate observation dates**: each FHIR `Observation` in the Vital Signs section is timestamped with the actual measurement date (not the export date); each lab result `Observation` is timestamped with the test date (user-entered or PDF-extracted)

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
| Auth | Better Auth |
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

Unit tests for the iOS app live in `apps/ios/HealthDashboardTests/` and mirror the web test suite:

- **`NormalizeTests.swift`** — HealthKit → `HealthRecord` normalisation (unit conversions, type mapping, sleep grouping)
- **`AggregationTests.swift`** — `AggregationService` daily summary computation (grouped averages, incremental recompute)
- **`LLMPromptTests.swift`** — On-device prompt construction; verifies no PII in Standard mode, no sub-daily timestamps, correct Enhanced mode gating
- **`IPSBundleTests.swift`** — FHIR Bundle structure (all 5 IPS section LOINC codes present, `type == "document"`, `urn:uuid:` fullUrls)

Run iOS tests via Xcode (`⌘U`) or from the command line:

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

## License

[MIT](LICENSE)
