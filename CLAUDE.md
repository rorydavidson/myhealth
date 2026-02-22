# Health Dashboard App

## Project Overview

A privacy-first, platform-agnostic health data visualization and insights application. Users import their health data from Apple Health (XML export) or Google Health Connect (via export), and the app normalizes, stores, visualizes, and provides LLM-powered insights on that data.

**Phase 1**: Web app (this phase)
**Phase 2**: iOS app with native HealthKit integration
**Phase 3**: Android app with native Health Connect integration

## Privacy Architecture — Core Principle

**Health data never leaves the user's device.** This is the foundational constraint of the entire architecture.

- All health data is stored client-side in the browser using **IndexedDB** (via Dexie.js) or **Origin Private File System (OPFS)** with **SQLite (wa-sqlite)**
- All data parsing, normalization, and aggregation happens **in the browser** — the server never sees raw health records
- The server exists only for: authentication, user preferences, and proxying LLM requests
- LLM integration receives **only anonymized, pre-aggregated summaries** computed client-side — never raw records, never timestamps more granular than daily, never PII
- No server-side database stores health data — the server DB contains only user accounts and preferences
- Users own their data completely — it lives in their browser storage and nowhere else
- Data export is a client-side operation (IndexedDB → JSON download) — exports include full provenance (source platform, device, original identifiers) so re-importing recreates the complete picture
- Clearing browser data deletes all health data permanently (the app warns about this and encourages periodic backups)

### What the server knows about a user's health data

**Nothing.** The server has zero access to health records. When the user asks the LLM a question, the client computes a summary like "7-day step average: 8,200; resting HR trend: declining 3% over 30 days" and sends only that text to the server's LLM proxy. The server forwards it to the LLM API and returns the response. The server never parses, stores, or logs health summaries.

### Privacy implications for LLM queries

- The client constructs the full LLM prompt including the anonymized health context
- The server's LLM proxy is a passthrough — it adds the system prompt (health education constraints, disclaimers) and forwards to the LLM API
- The server does **not** log prompt contents
- Users are shown exactly what data will be sent before each LLM query (transparency)
- An "offline mode" using WebLLM (in-browser inference) is a future option for users who want zero network health data exposure

## Tech Stack

### Backend (thin server)
- **Runtime**: Node.js with TypeScript
- **Framework**: Fastify
- **Database**: PostgreSQL (auth and user preferences only — no health data)
- **ORM**: Drizzle ORM
- **Auth**: Better Auth (email/password + OAuth)
- **LLM proxy**: Thin endpoint that forwards client-constructed prompts to Anthropic Claude API
- **API style**: REST with OpenAPI spec

### Frontend (where all health data lives)
- **Framework**: React 19 with TypeScript
- **Build tool**: Vite
- **Routing**: TanStack Router
- **State/data fetching**: TanStack Query (for server data like auth); custom hooks for local health data
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts (standard charts) + Apache ECharts (complex overlays, large datasets)
- **Component library**: Radix UI primitives
- **Client-side storage**: Dexie.js (IndexedDB wrapper) for structured health data; OPFS + wa-sqlite as future high-performance option
- **Data parsing**: Web Workers for background XML/JSON parsing (keeps UI responsive during large imports)

### LLM Integration
- **Provider**: Anthropic Claude API (primary), with architecture supporting swappable providers
- **Privacy model**: Two tiers — see "LLM Privacy Tiers" section below
- **Default (Standard mode)**: Client computes aggregated summaries → sends to server LLM proxy → proxy forwards to Claude API → response returned to client. No raw data leaves the device.
- **Enhanced mode (user opt-in per query)**: User can choose to include more detailed health data (e.g., lab result values, granular metrics) for more specific LLM responses. Requires explicit consent each time with clear warnings.
- **Never sent to LLM in any mode**: PII (name, DOB, email), device identifiers
- **Code-generation agent**: LLM generates a Dexie.js/IndexedDB query (not SQL) → client executes locally → results summarized and sent back to LLM for interpretation

### Internationalization (i18n)
- **Framework**: `react-i18next` + `i18next` — the standard for React apps with TypeScript
- **Language detection**: `i18next-browser-languagedetector` — detects browser language, with manual override stored in user preferences
- **Supported languages (Phase 1)**: English (`en`), French (`fr`)
- **Translation files**: JSON namespace files per locale in `apps/web/src/locales/{lang}/{namespace}.json`
- **Namespaces**: `common` (shared UI: buttons, labels, errors), `dashboard`, `import`, `insights`, `lab-results`, `settings`, `ips`, `auth`
- **Type safety**: Auto-generated types from English source files — TypeScript catches missing keys at compile time
- **Interpolation**: i18next built-in interpolation for dynamic values (e.g., `"{{count}} steps"`, `"{{value}} bpm"`)
- **Plurals**: i18next plural rules (English: `one`/`other`; French: `one`/`other`)
- **Number/date formatting**: `Intl.NumberFormat` and `Intl.DateTimeFormat` using the active locale — not hardcoded formats
- **Health metric units**: Unit labels translated per locale (e.g., "bpm" → "bpm" in both, "steps" → "pas", "kcal" → "kcal")
- **LLM prompts**: System prompts and disclaimers are locale-aware; user-facing LLM response formatting respects active language
- **RTL**: Not required for Phase 1 (English/French are LTR) — but layout uses logical CSS properties (`margin-inline-start` etc.) where practical to ease future RTL support

### Infrastructure
- **Monorepo**: Turborepo
- **Package manager**: pnpm
- **Containerization**: Docker + Docker Compose for local dev (PostgreSQL for auth only)
- **Testing**: Vitest (unit/integration), Playwright (e2e)
- **Linting**: Biome

## Design System & Visual Identity

This app must look and feel premium. Users are trusting it with their most personal data — the UI should inspire that trust through polish, clarity, and restraint. Think Apple Health meets Linear: calm, information-dense without feeling cluttered, and satisfying to interact with.

### Design principles
1. **Calm and clean** — generous whitespace, muted backgrounds, no visual noise. The data is the focus, not the chrome.
2. **Information density done right** — show lots of data without overwhelming. Use progressive disclosure: summary first, drill down on tap/click.
3. **Smooth and responsive** — every interaction should feel instant. Skeleton loaders, optimistic updates, smooth chart transitions. No layout shift, no jank.
4. **Consistent and systematic** — every component follows the same spacing, radius, shadow, and color rules. No one-off styles.
5. **Accessible** — WCAG 2.1 AA minimum. Sufficient contrast, keyboard navigable, screen reader compatible. Charts include data tables as accessible alternatives.

### Color system

Built on Tailwind CSS v4 with CSS custom properties for theme switching.

**Light mode (default):**
- Background: neutral-50 (`#fafafa`) for the page, white for cards
- Text: neutral-900 (`#171717`) primary, neutral-500 (`#737373`) secondary
- Borders: neutral-200 (`#e5e5e5`)
- Cards: white with subtle `shadow-sm` and 1px border

**Dark mode:**
- Background: neutral-950 (`#0a0a0a`) for the page, neutral-900 (`#171717`) for cards
- Text: neutral-50 (`#fafafa`) primary, neutral-400 (`#a3a3a3`) secondary
- Borders: neutral-800 (`#262626`)

**Accent / metric category colors** — each health category has a signature color used for charts, icons, and category badges:
- Activity (steps, distance, energy): blue-500 (`#3b82f6`)
- Heart (HR, resting HR, HRV): rose-500 (`#f43f5e`)
- Sleep: indigo-500 (`#6366f1`)
- Body (weight, body fat): amber-500 (`#f59e0b`)
- Vitals (SpO2, BP, respiratory): emerald-500 (`#10b981`)
- Lab Results: violet-500 (`#8b5cf6`)
- Workouts: orange-500 (`#f97316`)

These colors are used consistently everywhere — chart lines, metric cards, sidebar icons, trend indicators. Users learn to associate a color with a category at a glance.

**Semantic colors:**
- Positive trend / good: emerald-500
- Negative trend / attention: rose-500
- Neutral / stable: neutral-400
- Warning: amber-500
- Privacy / Enhanced mode warning: amber background with amber-700 text

### Typography
- **Font**: Inter (via `@fontsource/inter`) — clean, legible, designed for UI
- **Scale**: Tailwind's default type scale. Headings in `font-semibold`, body in `font-normal`
- **Numeric data**: Use `tabular-nums` (`font-variant-numeric: tabular-nums`) for all numbers in charts, tables, and metric cards — digits should align vertically
- **Large metric values**: `text-3xl font-bold tabular-nums` for hero numbers on dashboard cards (e.g., "8,247 steps")

### Spacing and layout
- **Base unit**: 4px (Tailwind's default). All spacing is multiples of 4.
- **Page layout**: Sidebar (240px fixed width, collapsible to 64px icon-only on mobile) + main content area with `max-w-7xl` centered
- **Card grid**: CSS Grid with `gap-4` (16px). Cards use `rounded-xl` (12px radius), `shadow-sm`, `p-6` padding
- **Section spacing**: `space-y-6` between dashboard sections, `space-y-4` within sections

### Component standards

**Cards** (the primary container):
- White background (dark: neutral-900), `rounded-xl`, `border border-neutral-200` (dark: neutral-800), `shadow-sm`
- `p-6` padding. Title in `text-sm font-medium text-neutral-500` (label-style), value in `text-3xl font-bold`
- Hover state for interactive cards: `hover:shadow-md transition-shadow`

**Charts**:
- Clean, minimal axes — only show what's necessary. Light gridlines (`neutral-100` / `neutral-800`)
- Tooltips: `rounded-lg shadow-lg` with the metric's category color as accent
- Smooth curve interpolation for line charts (`type="monotone"` in Recharts)
- Animated transitions when changing date ranges (300ms ease)
- Chart area fills with gradient from category color at 20% opacity to transparent
- No chart borders — charts float on the card background
- Responsive: charts resize fluidly, legends reposition on small screens

**Buttons**:
- Primary: category color background, white text, `rounded-lg`, `font-medium`
- Secondary: transparent with border, `rounded-lg`
- Ghost: no border, subtle hover background
- All buttons: `transition-colors duration-150`, `focus-visible:ring-2 ring-offset-2`

**Date range selector**:
- Pill-style segmented control for preset ranges (7d, 30d, 90d, 1y, All)
- Active pill filled with neutral-900 (dark: white), inactive in neutral-100
- Custom range opens a calendar popover

**Sidebar navigation**:
- Each category has its color-coded icon (from Lucide icons via `lucide-react`)
- Active state: filled background in category color at 10% opacity, text in category color
- Hover: subtle background shift
- Collapsible to icons-only on smaller screens with tooltip on hover

**Tables** (workout log, lab results):
- Alternating row backgrounds (`neutral-50` / white in light mode)
- Sticky header row
- Hover row highlight
- `tabular-nums` for all numeric cells

**Loading states**:
- Skeleton loaders that match the exact shape and size of the content they replace
- Pulse animation (`animate-pulse`)
- Never show a blank page — always show the layout with skeletons

**Empty states**:
- Friendly illustration + clear CTA. "No heart rate data yet — import your Apple Health data to get started."
- Never just a blank card or "No data"

**Transitions and animation**:
- Page transitions: subtle fade (150ms)
- Chart data transitions: smooth morph when changing date ranges (300ms)
- Card entrance: staggered fade-up on dashboard load (50ms delay between cards)
- Modal/dialog: fade + scale from 95% (150ms)
- Keep animations minimal and purposeful — never gratuitous

### Iconography
- **Icon set**: Lucide (`lucide-react`) — clean, consistent, 24px default
- Each metric category has a dedicated icon:
  - Activity: `Footprints`, `Route`, `Flame`
  - Heart: `Heart`, `HeartPulse`, `Activity`
  - Sleep: `Moon`, `BedDouble`
  - Body: `Scale`, `Percent`
  - Vitals: `Wind`, `Droplets`, `Gauge`
  - Lab Results: `FlaskConical`, `TestTube`
  - Workouts: `Dumbbell`, `Timer`

### Responsive breakpoints
- Mobile: < 768px — sidebar collapses, single-column card layout, simplified charts
- Tablet: 768px–1024px — sidebar icons-only, 2-column card grid
- Desktop: > 1024px — full sidebar, 2–3 column card grid, full chart detail

### Dark mode
- Follows system preference by default (`prefers-color-scheme`)
- Manual toggle in settings (stored in user preferences on server)
- All colors have dark mode variants defined via Tailwind's `dark:` modifier
- Charts and visualizations adapt — lighter lines on dark backgrounds, adjusted gradient opacity

## Project Structure

```
health-app/
├── CLAUDE.md
├── PLAN.md
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
├── docker-compose.yml
├── packages/
│   ├── shared/                  # Shared types, schemas, constants
│   │   ├── src/
│   │   │   ├── schemas/         # Open mHealth-inspired normalized data schemas (Zod)
│   │   │   ├── types/           # Shared TypeScript types
│   │   │   ├── constants/       # Health metric definitions, units, categories
│   │   │   └── coding/          # SNOMED CT + LOINC code mappings (static lookup tables)
│   │   └── package.json
│   └── db/                      # Server database package (Drizzle — auth/prefs only)
│       ├── src/
│       │   ├── schema/          # Drizzle table definitions (users, preferences)
│       │   └── migrations/
│       └── package.json
├── apps/
│   ├── server/                  # Thin Fastify server
│   │   ├── src/
│   │   │   ├── routes/          # Auth routes, user prefs, LLM proxy
│   │   │   ├── plugins/         # Fastify plugins (auth, db, etc.)
│   │   │   ├── llm/             # LLM proxy (system prompt, forwarding, rate limiting)
│   │   │   └── index.ts
│   │   └── package.json
│   └── web/                     # React SPA — where all health data lives
│       ├── src/
│       │   ├── components/      # UI components
│       │   ├── routes/          # TanStack Router route components
│       │   ├── hooks/           # Custom React hooks
│       │   ├── lib/             # Utilities, API client
│       │   ├── locales/         # i18n translation files
│       │   │   ├── en/          # English (source language)
│       │   │   │   ├── common.json
│       │   │   │   ├── auth.json
│       │   │   │   ├── dashboard.json
│       │   │   │   ├── import.json
│       │   │   │   ├── insights.json
│       │   │   │   ├── lab-results.json
│       │   │   │   ├── settings.json
│       │   │   │   └── ips.json
│       │   │   └── fr/          # French
│       │   │       ├── common.json
│       │   │       ├── auth.json
│       │   │       ├── dashboard.json
│       │   │       ├── import.json
│       │   │       ├── insights.json
│       │   │       ├── lab-results.json
│       │   │       ├── settings.json
│       │   │       └── ips.json
│       │   ├── db/              # Dexie.js schema, health data access layer
│       │   ├── workers/         # Web Workers for parsing and aggregation
│       │   │   ├── apple-health-parser.worker.ts
│       │   │   ├── health-connect-parser.worker.ts
│       │   │   ├── pdf-extractor.worker.ts   # PDF text extraction for lab results
│       │   │   └── aggregation.worker.ts
│       │   ├── services/        # Client-side business logic
│       │   │   ├── import.ts    # Import orchestration
│       │   │   ├── normalize.ts # Data normalization
│       │   │   ├── aggregate.ts # Summary computation
│       │   │   ├── lab-results.ts # Lab result PDF handling and value extraction
│       │   │   ├── llm.ts       # LLM prompt construction (client-side, tiered privacy)
│       │   │   └── ips.ts       # International Patient Summary (IPS) FHIR Bundle generation
│       │   └── main.tsx
│       └── package.json
└── .github/
    └── workflows/               # CI/CD
```

## Client-Side Data Model

### IndexedDB Schema (via Dexie.js)

**`healthRecords` store** — the core data:

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| id | string (UUID) | PK | Auto-generated |
| metricType | string | Yes (compound) | e.g., `step_count`, `heart_rate`, `sleep_session` |
| value | number | No | Measured value (null for category types) |
| unit | string | No | e.g., `count`, `bpm`, `kg` |
| startTime | Date | Yes (compound) | Start of measurement period |
| endTime | Date | No | End of measurement period |
| sourcePlatform | string | Yes | `apple_health` or `health_connect` |
| sourceDevice | string | No | Device name |
| sourceType | string | No | Original type identifier (e.g., `HKQuantityTypeIdentifierStepCount`, `StepsRecord`) |
| importId | string | Yes | FK to `imports` store — links record to its import |
| metadata | object | No | Sleep stages, workout details, etc. |

Compound index on `[metricType+startTime]` for efficient time-range queries per metric.

**`dailySummaries` store** — pre-aggregated for dashboard performance:

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| id | string | PK | `{metricType}:{date}` |
| metricType | string | Yes (compound) | Metric being summarized |
| date | string (YYYY-MM-DD) | Yes (compound) | Summary date |
| avg | number | No | Daily average |
| min | number | No | Daily minimum |
| max | number | No | Daily maximum |
| sum | number | No | Daily sum (for additive metrics) |
| count | number | No | Number of records |

**`labResults` store** — user-uploaded lab reports:

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| id | string (UUID) | PK | Auto-generated |
| fileName | string | No | Original PDF file name |
| date | string (YYYY-MM-DD) | Yes | Date of the lab test (user-entered or extracted) |
| category | string | Yes | e.g., `blood_panel`, `lipid_panel`, `thyroid`, `metabolic`, `other` |
| pdfBlob | Blob | No | The original PDF stored as a binary blob |
| extractedText | string | No | Full text extracted from the PDF (client-side) |
| structuredValues | object | No | Parsed key-value pairs with optional LOINC coding (e.g., `{ "HDL": { value: 55, unit: "mg/dL", flag: "normal", referenceRange: "40-60", loincCode: "2085-9" } }`) |
| notes | string | No | User-added notes |
| createdAt | Date | No | When the lab result was added |

**`imports` store** — import history and provenance:

| Field | Type | Description |
|-------|------|-------------|
| id | string | PK |
| platform | string | `apple_health` or `health_connect` |
| fileName | string | Original file name (for user reference) |
| exportDate | string | Date the export was generated (from Apple Health `<ExportDate>` or equivalent) |
| startedAt | Date | When import processing began |
| completedAt | Date | When import processing finished |
| recordCount | number | Records imported |
| status | string | `processing`, `completed`, `failed` |
| dateRange | object | `{ earliest: Date, latest: Date }` — time span of records in this import |

### Data export format

The JSON export contains all four stores (`healthRecords`, `dailySummaries`, `imports`, `labResults`) with full fidelity. Lab result PDFs are included as base64-encoded blobs. Every record retains its `sourcePlatform`, `sourceType` (original Apple Health / Health Connect identifier), `sourceDevice`, and `importId`. Re-importing this JSON into a fresh browser recreates the exact same state — including the link back to which Apple Health or Health Connect export each record came from. The `imports` store preserves the original file name, export date, and date range so the user can see their full import history after a restore.

### Storage budget

IndexedDB has no hard limit but browsers may prompt the user if storage exceeds ~50% of available disk space. A typical 5-year Apple Health dataset normalizes to roughly 50–200 MB in IndexedDB. The app displays current storage usage in settings and warns if approaching limits.

## Key Health Metrics (Phase 1)

### Activity
- Steps (`step_count`, count)
- Distance walking/running (`distance`, km)
- Active energy burned (`active_energy`, kcal)
- Flights climbed (`flights_climbed`, count)

### Heart
- Heart rate (`heart_rate`, bpm)
- Resting heart rate (`resting_heart_rate`, bpm)
- Heart rate variability (`hrv`, ms)

### Body
- Weight (`body_mass`, kg)
- Body fat percentage (`body_fat`, %)

### Sleep
- Sleep sessions (`sleep_session`) with stages (awake, light, deep, REM)
- Time in bed, time asleep

### Vitals
- Blood oxygen (`oxygen_saturation`, %)
- Blood pressure (`blood_pressure`, mmHg — systolic/diastolic in metadata)
- Respiratory rate (`respiratory_rate`, breaths/min)

### Workouts
- Workout sessions with type, duration, distance, calories

### Lab Results
- User-uploaded PDF lab reports stored locally as binary blobs
- Extracted text (via client-side PDF parsing) stored for search and LLM context
- Common lab values tracked: blood panels (CBC, CMP), lipid panels, thyroid, A1C, etc.
- Lab results are date-stamped and categorized but not normalized into `healthRecords` — they remain as documents with extracted structured data

## Clinical Coding — SNOMED CT & LOINC

All health data is tagged with standardized clinical codes to enable interoperability and future IPS (International Patient Summary) export.

### Coding strategy
- **LOINC** is the primary coding system for observations (vital signs, lab results) — this aligns with IPS requirements
- **SNOMED CT** is included as supplementary coding for richer clinical semantics
- Codes are stored as part of each `metricType` definition in the shared package — a static lookup table mapping internal metric types to their LOINC and SNOMED CT codes
- Lab result `structuredValues` also carry LOINC codes per test (e.g., HDL → LOINC 2085-9)
- **All codes should be verified against a local SNOMED CT terminology server during development** (the SNOMED International browser API at `browser.ihtsdotools.org` can be run locally via Snowstorm)

### Code mapping table

Each internal `metricType` maps to a LOINC code (primary) and SNOMED CT code (supplementary):

| Internal metricType | LOINC Code | LOINC Display | SNOMED CT Code | SNOMED CT Display |
|---------------------|-----------|---------------|----------------|-------------------|
| `heart_rate` | 8867-4 | Heart rate | 364075005 | Heart rate |
| `resting_heart_rate` | 40443-4 | Resting heart rate | 444981005 | Resting heart rate |
| `hrv` | 80404-7 | R-R interval.standard deviation | — | *verify via local server* |
| `blood_pressure` | 85354-9 | Blood pressure panel | 75367002 | Blood pressure |
| `blood_pressure_systolic` | 8480-6 | Systolic blood pressure | 271649006 | Systolic blood pressure |
| `blood_pressure_diastolic` | 8462-4 | Diastolic blood pressure | 271650006 | Diastolic blood pressure |
| `oxygen_saturation` | 2708-6 | Oxygen saturation | 431314004 | Peripheral oxygen saturation |
| `respiratory_rate` | 9279-1 | Respiratory rate | 86290005 | Respiratory rate |
| `body_mass` | 29463-7 | Body weight | 27113001 | Body weight |
| `body_fat` | 41982-0 | Percentage of body fat | — | *verify via local server* |
| `step_count` | 55423-8 | Number of steps in unspecified time | — | *verify via local server* |
| `active_energy` | 41981-2 | Calories burned | — | *verify via local server* |
| `distance` | 41953-1 | Walking distance | — | *verify via local server* |
| `sleep_session` | 93832-4 | Sleep duration | 248263006 | Duration of sleep |
| `flights_climbed` | — | *no standard LOINC* | — | *verify via local server* |

### Lab result LOINC codes (common panels)

| Test | LOINC Code | Display |
|------|-----------|---------|
| Total Cholesterol | 2093-3 | Cholesterol [Mass/volume] in Serum or Plasma |
| HDL Cholesterol | 2085-9 | HDL Cholesterol |
| LDL Cholesterol | 2089-1 | LDL Cholesterol |
| Triglycerides | 2571-8 | Triglycerides |
| Hemoglobin A1C | 4548-4 | Hemoglobin A1c/Hemoglobin.total in Blood |
| Fasting Glucose | 1558-6 | Fasting glucose |
| TSH | 3016-3 | TSH |
| Free T4 | 3024-7 | Free T4 |
| Free T3 | 3051-0 | Free T3 |
| Hemoglobin | 718-7 | Hemoglobin |
| WBC | 6690-2 | Leukocytes |
| RBC | 789-8 | Erythrocytes |
| Platelets | 777-3 | Platelets |

Codes marked "verify via local server" should be confirmed against the local Snowstorm instance during development. The table above uses well-established codes but is not exhaustive.

### How codes are stored

Codes are **not stored per-record** in IndexedDB (that would bloat storage). Instead, the shared package contains a `METRIC_CODING` constant that maps `metricType` → `{ loinc: { code, display }, snomed?: { code, display } }`. The code lookup happens at export time (IPS generation) and when displaying clinical context in the UI.

For lab results, `structuredValues` entries include an optional `loincCode` field so that extracted lab values can be coded. The PDF extraction pipeline attempts to match test names to known LOINC codes using the static lookup table. Users can also manually assign codes during review.

## Apple Health XML Parsing

Apple Health exports can be 100 MB to 2+ GB. Parsing happens **entirely in the browser** using a Web Worker:

- Use the `sax` npm package (browser-compatible) in a dedicated Web Worker
- Stream the XML using `File.stream()` / `ReadableStream` — never load the entire file into memory
- Post parsed records back to the main thread in batches (1000 records) for IndexedDB insertion
- Report progress to the UI via Worker messages

Key elements to extract:
- `<Record>` — individual measurements (the bulk of data)
- `<Workout>` — workout sessions
- `<ActivitySummary>` — daily activity rings
- `<Correlation>` — grouped records (e.g., blood pressure)

Map `HKQuantityTypeIdentifier*` and `HKCategoryTypeIdentifier*` to internal `metricType` values.

## LLM Integration Guidelines

### LLM Privacy Tiers

The app provides two tiers of LLM interaction. The user controls which tier is active **per query**.

#### Standard Mode (default)
- **No raw health records** sent to the LLM — only aggregates (averages, min/max, trends)
- **No PII** (name, DOB, email, device names) in prompts
- **No granular timestamps** — daily granularity maximum
- **No lab result values** — only general categories ("recent blood work available")
- The client constructs the full prompt; the server is a passthrough proxy
- The server does not log, store, or inspect prompt contents
- Users see a preview of exactly what data will be sent before each query

#### Enhanced Mode (explicit user opt-in per query)
For more specific, personalized LLM responses, the user can choose to include additional data. This requires:
1. **Explicit opt-in** — a toggle the user activates before sending the query, defaulting to off
2. **Clear warning** — displayed prominently: "You are about to send the following health data to [provider]. This data will leave your device and be processed by a third-party AI service."
3. **Data preview** — the user sees exactly what additional data will be included and can deselect specific items
4. **Per-query consent** — opting in does not carry over to the next query; the toggle resets each time

What Enhanced Mode can include (user selects from these):
- **Lab result values**: specific test results (e.g., "HDL: 55 mg/dL, LDL: 120 mg/dL, A1C: 5.4%")
- **Granular health metrics**: individual data points rather than just aggregates (e.g., daily heart rate readings over a week)
- **Longer time ranges**: detailed data over extended periods for trend analysis
- **Cross-metric context**: multiple metric categories combined for correlation insights

What Enhanced Mode **never** includes (even if opted in):
- PII (name, DOB, email, address)
- Device identifiers or source device names
- GPS or location data
- Exact timestamps below daily granularity

### How it works
1. User asks a question in the chat UI
2. Client computes relevant context from IndexedDB:
   - **Standard mode**: aggregated summaries only (e.g., "7-day step average: 8,200; resting HR trend: declining 3%")
   - **Enhanced mode**: adds selected detailed data (e.g., actual lab values, daily breakdowns)
3. Client constructs the full prompt: system instructions + health context + user question
4. Client shows the user what will be sent (collapsible "data sent" panel)
   - In Enhanced mode, the warning and data preview are prominent and require confirmation
5. Client sends the prompt to the server's `/api/llm/query` endpoint
6. Server adds rate limiting, appends the system prompt (health education constraints, "not medical advice" disclaimer), forwards to Claude API
7. Response streamed back to the client

### System prompt constraints
- Constrain to health education, not medical diagnosis
- Never suggest medications or treatments
- Always include "this is not medical advice" disclaimer
- Encourage consulting healthcare professionals for concerns
- Only interpret the data provided — never ask for more
- In Enhanced mode: acknowledge the additional data but still maintain all disclaimers

## International Patient Summary (IPS) Export

The app can generate an IPS — a standardized clinical health summary conforming to the HL7 FHIR IPS Implementation Guide (based on ISO/EN 27269). This runs entirely client-side.

### What is an IPS?
A minimal, portable health record containing essential information for cross-border or cross-provider care. It's a FHIR R4 Bundle (type: "document") with a Composition resource that organizes data into standard sections.

### What gets included
Not all app data maps to IPS. Only clinically relevant data is included:

| App Data | IPS Section | LOINC Section Code |
|----------|------------|-------------------|
| Heart rate, resting HR, blood pressure, SpO2, respiratory rate, body weight | **Vital Signs** | 8716-3 |
| Lab results (blood panels, lipids, A1C, thyroid, CBC) | **Results** | 30954-2 |
| Sleep, activity | *Not included* — IPS is for clinical essentials, not fitness tracking |
| Workouts | *Not included* |

### Required IPS sections the app cannot populate
The IPS spec requires **Medication Summary**, **Allergies and Intolerances**, and **Problem List**. Since this app doesn't track those, the IPS export includes these sections with "no information available" entries (as the spec allows). Users can optionally add basic medication and allergy information in a future enhancement.

### Export formats
- **FHIR JSON**: The canonical IPS Bundle as a `.json` file — machine-readable, interoperable with EHR systems
- **PDF**: A human-readable rendered summary generated client-side using `pdfmake` from the FHIR Bundle data

### Technical implementation
- Uses `@types/fhir` for TypeScript type definitions of FHIR R4 resources
- All FHIR resources generated client-side in `web/src/services/ips.ts`
- Patient resource populated from user profile (name only — user enters this at export time, it's not stored)
- Observations coded with LOINC (primary) and SNOMED CT (supplementary) from the `METRIC_CODING` lookup
- Lab result observations coded with LOINC codes from `structuredValues.loincCode`
- PDF generation via `pdfmake` — entirely client-side, no server involvement
- The IPS Bundle never touches the server — it's generated and downloaded in the browser

## Conventions

- All dates/times in health records stored as ISO 8601 strings in UTC
- API responses use camelCase
- Server database columns use snake_case
- Client-side IndexedDB fields use camelCase
- Health metric values stored in SI/metric units internally; convert for display based on user preference
- Use Zod for runtime validation on both client and server
- Error responses from server follow Problem Details format (RFC 9457)
- File size limit for imports: 2 GB (Apple Health export max practical size)
- **All user-facing strings must use i18n translation keys** — never hardcode display text in components. Use `useTranslation()` hook with the appropriate namespace (e.g., `const { t } = useTranslation('dashboard')`). English is the source language; French translations must be kept in sync.
- **Number and date formatting** must use `Intl.NumberFormat` / `Intl.DateTimeFormat` with the active locale — never format manually (e.g., no hardcoded comma/period decimal separators)
- **Translation key naming**: dot-separated, descriptive (e.g., `import.progress.parsingXml`, `dashboard.card.stepsToday`, `insights.privacy.enhancedWarning`)

## Commands

```bash
# Install dependencies
pnpm install

# Start dev environment (auth database + all apps)
docker compose up -d
pnpm dev

# Run tests
pnpm test

# Run e2e tests
pnpm test:e2e

# Lint and format
pnpm lint
pnpm format

# Database migrations (server auth DB only)
pnpm --filter @health-app/db migrate
pnpm --filter @health-app/db generate

# Build
pnpm build
```
