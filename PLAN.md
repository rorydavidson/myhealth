# Health Dashboard App — Development Plan

## Phase 1: Web Application

### Milestone 1: Project Foundation
> Set up monorepo, tooling, and basic server/client shells.

- [ ] **1.1 Monorepo setup**
  - Initialize Turborepo with pnpm workspaces
  - Create `apps/server`, `apps/web`, `packages/shared`, `packages/db`
  - Configure `turbo.json` with build/dev/test/lint pipelines
  - Add root-level scripts in `package.json`

- [ ] **1.2 Shared package**
  - Define health metric type constants and unit mappings
  - Create `METRIC_CODING` constant: maps each internal `metricType` to its LOINC code (primary) and SNOMED CT code (supplementary)
  - Create `LAB_CODING` constant: maps common lab test names to LOINC codes for automated lab result coding
  - Verify codes against local Snowstorm SNOMED CT server during development
  - Create Zod schemas for normalized health records
  - Create shared TypeScript types (API request/response shapes, LLM prompt types)

- [ ] **1.3 Server database package**
  - `docker-compose.yml` with PostgreSQL (auth and user preferences only — no health data)
  - Drizzle ORM setup with connection config
  - Schema: `users`, `user_preferences`
  - Initial migration

- [ ] **1.4 Server shell**
  - Fastify app with TypeScript
  - Plugins: CORS, auth, database connection, request validation (Zod)
  - Health check endpoint (`GET /health`)
  - OpenAPI spec generation with `@fastify/swagger`
  - Error handling with RFC 9457 Problem Details

- [ ] **1.5 Web client shell and design foundation**
  - Vite + React 19 + TypeScript
  - TanStack Router with file-based routes
  - TanStack Query setup (for server data: auth, preferences)
  - Tailwind CSS v4 with CSS custom properties for theme colors
  - Install Inter font (`@fontsource/inter`), configure as default
  - Install Lucide icons (`lucide-react`)
  - Radix UI primitives installed
  - **Design system foundation**:
    - Tailwind config: metric category color palette (blue/rose/indigo/amber/emerald/violet/orange), border radius tokens, shadow tokens
    - Dark mode setup: `prefers-color-scheme` detection + manual toggle, `dark:` variants for all base styles
    - Base component primitives: Card, Button (primary/secondary/ghost), Skeleton loader, EmptyState
    - Page layout shell: collapsible sidebar (240px → 64px), main content area (`max-w-7xl`), top bar
    - Sidebar with color-coded category icons, active/hover states
    - `tabular-nums` utility class for all numeric displays
    - Page transition wrapper (subtle fade)
    - Responsive breakpoints: mobile single-column, tablet 2-col, desktop 2-3 col grid

- [ ] **1.6 Client-side database setup**
  - Dexie.js (IndexedDB wrapper) initialization
  - Define stores: `healthRecords`, `dailySummaries`, `imports`, `labResults`
  - Compound indexes: `[metricType+startTime]` on healthRecords, `[metricType+date]` on dailySummaries
  - Data access layer: typed hooks/functions for CRUD operations
  - Storage usage monitoring utility (show user how much space their data uses)

- [ ] **1.7 Internationalization (i18n) setup**
  - Install `react-i18next`, `i18next`, `i18next-browser-languagedetector`
  - Configure i18next instance: language detection (browser → user preference), fallback to `en`, namespace lazy loading
  - Create `locales/en/` and `locales/fr/` directories with initial namespace files (`common.json`, `auth.json`, `dashboard.json`, `import.json`, `insights.json`, `lab-results.json`, `settings.json`, `ips.json`)
  - Populate English source strings as components are built (English is the source of truth)
  - Provide complete French translations for all English strings
  - Set up type-safe translation keys: auto-generate TypeScript types from English JSON files so missing keys are caught at compile time
  - Create `useLocaleFormat()` hook wrapping `Intl.NumberFormat` and `Intl.DateTimeFormat` with the active i18next locale — all number/date rendering goes through this
  - Wrap app root in `I18nextProvider`
  - All user-facing text from this point forward must use `t()` — no hardcoded strings

- [ ] **1.8 Dev tooling**
  - Biome config for linting and formatting
  - Vitest config for both server and web packages
  - CI workflow (GitHub Actions): lint, typecheck, test, build

---

### Milestone 2: Authentication & User Management
> Users can sign up, log in, and manage their profile.

- [ ] **2.1 Auth backend**
  - Better Auth integration with Fastify
  - Email/password registration and login
  - Session management (HTTP-only cookies)
  - Password reset flow

- [ ] **2.2 Auth frontend**
  - Sign up page: centered card layout, clean form with clear labels, primary CTA button, link to login
  - Login page: matching style, "Remember me" toggle, link to password reset and sign up
  - Password reset page: single-field form, clear success/error states
  - All auth pages: minimal layout (no sidebar), app logo/wordmark centered above the form, subtle background
  - Auth-protected route wrapper with redirect to login
  - User menu (top-right): avatar circle with initials, dropdown with profile, settings, logout — smooth open/close animation

- [ ] **2.3 User settings**
  - Settings page: display name, preferred units (metric/imperial), timezone, **language selector** (English / Français)
  - API endpoint for updating user preferences (stored server-side — not health data)
  - Store unit preference; all conversions happen at display time
  - Language preference stored in user preferences (server-side) and applied on login; also stored locally for pre-auth pages
  - Storage management section: show IndexedDB usage, option to clear all health data with confirmation

---

### Milestone 3: Apple Health Data Import
> Users can upload their Apple Health export and it's parsed entirely in the browser.

- [ ] **3.1 Web Worker parsing infrastructure**
  - Apple Health parser Web Worker (`apple-health-parser.worker.ts`)
  - Streaming XML parsing using `sax` npm package inside the Worker
  - Read the ZIP file client-side using `fflate` or similar (no server upload)
  - Extract `export.xml` from the ZIP in the browser
  - Stream XML via `ReadableStream` / chunked reading — never load entire file into memory
  - Post parsed records to main thread in batches of 1000 for IndexedDB insertion
  - Progress reporting via Worker messages (% complete based on bytes read)

- [ ] **3.2 Apple Health type mapping**
  - Map Apple Health type identifiers to internal metric types (in shared package):
    - `HKQuantityTypeIdentifierStepCount` → `step_count`
    - `HKQuantityTypeIdentifierHeartRate` → `heart_rate`
    - `HKCategoryTypeIdentifierSleepAnalysis` → `sleep_session`
    - (full mapping covering all Phase 1 metrics)
  - Handle unit conversions (Apple exports in mixed units — normalize to SI)
  - Handle timezone offsets in Apple Health timestamps (convert to UTC)

- [ ] **3.3 Data normalization and storage**
  - Normalize parsed records into the Dexie.js `healthRecords` schema
  - Preserve original source type identifier (e.g., `HKQuantityTypeIdentifierStepCount`) in `sourceType` field — this ensures export/reimport can recreate the exact link back to Apple Health
  - Link each record to its import via `importId`
  - Deduplicate records (same metric, same time range, same source)
  - Validate values within reasonable ranges (e.g., heart rate 20–300 bpm)
  - Batch insert into IndexedDB via Dexie.js `bulkPut`
  - Track import in the `imports` store (status, record count, timing, original file name, export date, date range)

- [ ] **3.4 Daily summary computation**
  - Aggregation Worker (`aggregation.worker.ts`) or main-thread computation after import
  - Compute daily summaries (avg, min, max, sum, count) per metric per day
  - Store in `dailySummaries` IndexedDB store
  - Incremental: only recompute days affected by new import data

- [ ] **3.5 Import UI**
  - Import page with polished drag-and-drop zone: dashed border, icon, "Drop your Apple Health export here" — visual feedback on drag-over (border color change, subtle scale)
  - Clear privacy messaging styled prominently: shield icon + "Your data stays on this device. Nothing is uploaded to our servers."
  - Multi-step progress indicator: reading ZIP → parsing XML → storing records → computing summaries
    - Smooth progress bar with percentage, record count updating in real time
    - Each step shows a checkmark when complete, spinner when active
  - Import history: clean table with date, record count, status badge (green for completed, amber for processing, red for failed)
  - Error display: red-tinted card with clear actionable message and retry option
  - File size warning for very large exports (>1 GB): amber banner with estimated processing time

---

### Milestone 4: Dashboard & Data Visualization
> The core value — a clean, useful dashboard showing health trends.
> All data read from local IndexedDB — no server calls for health data.

- [ ] **4.1 Dashboard layout**
  - Dashboard home page with metric cards (today's snapshot)
  - Cards follow design system: white/dark bg, `rounded-xl`, `shadow-sm`, hero number in `text-3xl font-bold tabular-nums`, label in `text-sm font-medium text-neutral-500`
  - Each card color-coded by metric category (blue for activity, rose for heart, etc.)
  - Staggered fade-up entrance animation on load (50ms delay between cards)
  - Global date range selector: pill-style segmented control (7d, 30d, 90d, 1y, All) + custom calendar popover
  - Metric category tabs or sidebar sections: Activity, Heart, Body, Sleep, Vitals — each with its category icon and color
  - Data sourced entirely from local `dailySummaries` and `healthRecords` stores

- [ ] **4.2 Activity views**
  - Steps: daily bar chart + 7-day rolling average trend line
  - Distance: daily totals
  - Active energy: daily totals
  - Activity summary cards: today's steps, distance, calories with comparison to average

- [ ] **4.3 Heart views**
  - Heart rate: daily min/avg/max area chart
  - Resting heart rate: daily trend line
  - HRV: daily trend line with context (higher = generally better)

- [ ] **4.4 Sleep views**
  - Sleep duration: nightly bar chart
  - Sleep stages: stacked bar chart (awake, light, deep, REM) per night
  - Time to bed / wake time: scatter or line chart showing consistency
  - Sleep score or efficiency (time asleep / time in bed)

- [ ] **4.5 Body views**
  - Weight: trend line with optional goal line
  - Body fat %: trend line

- [ ] **4.6 Vitals views**
  - Blood oxygen: daily averages
  - Blood pressure: systolic/diastolic trend lines
  - Respiratory rate: daily averages

- [ ] **4.7 Workout log**
  - Paginated list of workouts: type, date, duration, distance, calories
  - Workout type filter
  - Monthly workout frequency chart

- [ ] **4.8 Chart polish and interactions**
  - Smooth curve interpolation (`type="monotone"`) for all line/area charts
  - Chart area fills: gradient from category color at 20% opacity to transparent
  - Minimal axes — light gridlines, no chart borders, charts float on card background
  - Animated transitions when changing date ranges (300ms ease)
  - Zoom and pan on all time-series charts
  - Hover tooltips: `rounded-lg shadow-lg` with category color accent, exact values and dates
  - Responsive: charts resize fluidly, legends reposition on small screens
  - Skeleton loaders that match exact chart dimensions while data loads from IndexedDB

- [ ] **4.9 Empty and loading states**
  - Every metric view has a designed empty state: friendly illustration + clear CTA ("No heart rate data yet — import your Apple Health data to get started")
  - Skeleton loaders match the exact shape/size of the content they replace (pulse animation)
  - Never show a blank card or generic "No data" text
  - Loading → data transition is smooth (fade-in, no layout shift)

---

### Milestone 5: Trends & Correlations
> Help users see patterns over time and across metrics.
> All computation happens client-side.

- [ ] **5.1 Client-side trend analysis**
  - Compute trend direction (improving/stable/declining) for each metric over a period
  - Weekly and monthly comparison (this week vs last week, this month vs last month)
  - Percentile ranking against the user's own historical data
  - All computed from local `dailySummaries` data — no server calls

- [ ] **5.2 Trends overview page**
  - Summary cards for each metric: category-colored trend arrow (emerald up = improving, rose down = declining, neutral-400 flat = stable), percentage change, sparkline mini-chart
  - "This week vs last week" comparison: horizontal bars with before/after overlay, clear percentage delta
  - Significant changes (>10% deviation) highlighted with a subtle attention badge and slightly elevated card shadow

- [ ] **5.3 Correlation explorer**
  - Dual metric selector: two dropdown pickers, each styled with the metric's category color
  - Overlay chart: two Y-axes, each line in its metric's category color, shared X-axis
  - Scatter plot: one metric vs another (e.g., steps vs sleep quality), dots colored by density
  - Correlation coefficient displayed as a badge: strong (>0.7) in emerald, moderate (0.4-0.7) in amber, weak (<0.4) in neutral

---

### Milestone 6: Lab Results
> Users can upload lab result PDFs, view them, and optionally share specific values with the LLM.

- [ ] **6.1 Lab result upload and storage**
  - Upload page for PDF lab reports (drag-and-drop or file picker)
  - Store the original PDF as a binary blob in the `labResults` IndexedDB store
  - All storage is client-side — PDFs never leave the device
  - Clear messaging: "Your lab results stay on this device."
  - User enters or confirms: date of test, lab category (blood panel, lipid panel, thyroid, metabolic, other)

- [ ] **6.2 Client-side PDF text extraction**
  - Web Worker (`pdf-extractor.worker.ts`) using `pdf.js` (Mozilla's client-side PDF renderer/parser)
  - Extract raw text from the PDF entirely in the browser
  - Store extracted text in `labResults.extractedText` for search and LLM context
  - Best-effort structured value extraction: parse common lab result patterns (test name, value, unit, reference range, flag) into `structuredValues` object
  - Auto-assign LOINC codes to extracted values using the `LAB_CODING` lookup table (e.g., "HDL" → LOINC 2085-9)
  - User can review and manually correct extracted values and their LOINC code assignments

- [ ] **6.3 Lab results viewer**
  - Lab results list page: date, category, file name, key values
  - Detail view: rendered PDF (via `pdf.js` in-browser viewer) alongside extracted structured values
  - Timeline view: track specific lab values over time across multiple reports (e.g., cholesterol trend across yearly blood work)
  - User can add notes to each lab result

- [ ] **6.4 Lab results in dashboard**
  - Lab results section in the dashboard sidebar/tabs
  - Summary cards for most recent lab values with reference ranges
  - Trend charts for tracked lab values (e.g., A1C over time, lipid panel trends)

---

### Milestone 7: LLM-Powered Insights
> Conversational AI that helps users understand their health data.
> Two privacy tiers: Standard (aggregates only) and Enhanced (user opts in to share more detail).

- [ ] **7.1 LLM proxy endpoint (server)**
  - `POST /api/llm/query` — receives the client-constructed prompt, forwards to Claude API
  - Appends system prompt (health education constraints, "not medical advice" disclaimer)
  - Rate limiting per user (prevent abuse)
  - Does NOT log, store, or inspect prompt contents
  - Streams response back to client via SSE or chunked transfer
  - Anthropic Claude API integration via `@anthropic-ai/sdk`

- [ ] **7.2 Client-side LLM prompt construction (Standard mode)**
  - Service in `web/src/services/llm.ts` that:
    - Computes relevant aggregated context from IndexedDB for the user's question
    - Builds the prompt: system context + anonymized health summary + user question
    - Strips all PII, device names, granular timestamps
    - Enforces daily granularity maximum — no individual data points
    - Lab results referenced only as categories ("recent blood panel available") — no values
  - "Data sent" preview panel: user sees exactly what will be sent before confirming
  - Context computation strategies:
    - "How was my sleep this week?" → compute 7-day sleep averages, stage distribution
    - "Am I getting enough exercise?" → compute 30-day step/workout averages, trend
    - General question → compute broad summary across all metrics

- [ ] **7.3 Enhanced mode (user opt-in per query)**
  - Toggle in the chat UI: "Include detailed health data for a more specific response" — defaults to OFF
  - When toggled on, show a prominent warning:
    > "You are about to send detailed health data to [AI provider]. This data will leave your device and be processed by a third-party AI service. Only the data shown below will be sent."
  - Data selector: user can choose which additional data to include:
    - Lab result values (specific test results with numbers and units)
    - Granular health metrics (daily readings instead of just averages)
    - Extended time ranges
  - Each data category has a checkbox — user controls exactly what is shared
  - Full preview of the data that will be sent, with individual items removable
  - Consent is **per-query** — the toggle resets after each query is sent
  - Even in Enhanced mode, PII and device identifiers are never included

- [ ] **7.4 Insights UI**
  - Chat-style interface: clean message bubbles, user messages right-aligned, AI responses left-aligned with subtle card styling
  - Privacy tier indicator: persistent pill/badge showing "Standard" (green) or "Enhanced" (amber) mode
  - Pre-built quick-ask buttons: pill-shaped, subtle border, arranged as a horizontal scrollable row — "How was my sleep this week?", "Am I getting enough exercise?", "What do my latest lab results mean?"
  - Collapsible "data sent to AI" panel: monospace text in a neutral-100 (dark: neutral-800) code-block style, with a "Show/hide" toggle — highlighted with amber border in Enhanced mode
  - Streamed response display: text appears word-by-word with a subtle cursor/typing indicator
  - "Not medical advice" disclaimer: muted text below every AI response, consistent styling
  - Conversation history stored locally (IndexedDB) — not on server
  - Empty state for first visit: welcoming intro message explaining what the AI can help with, with quick-ask buttons prominent

- [ ] **7.5 Weekly summary generation**
  - Auto-generate weekly health summary using aggregated data + LLM (Standard mode only)
  - Summary card on dashboard home page
  - Cached locally — regenerate only if new data imported for that week

---

### Milestone 8: Google Health Connect Import
> Support the second major platform for data import.

- [ ] **8.1 Health Connect parser**
  - Health Connect parser Web Worker (`health-connect-parser.worker.ts`)
  - Parse JSON export format (from Health Connect export or Health Auto Export app)
  - Map Health Connect record types to internal metric types (in shared package):
    - `StepsRecord` → `step_count`
    - `HeartRateRecord` → `heart_rate`
    - `SleepSessionRecord` → `sleep_session`
    - (full mapping covering all Phase 1 metrics)
  - Preserve original Health Connect record type in `sourceType` field (e.g., `StepsRecord`)
  - Same normalization, deduplication, and provenance-tracking pipeline as Apple Health
  - All parsing happens client-side — no server involvement

- [ ] **8.2 Import instructions UI**
  - Guide page explaining how to export data from Health Connect
  - Option 1: Use Health Auto Export app (link + setup instructions)
  - Option 2: Manual export from Health Connect settings and upload
  - Same import progress UI and local import history as Apple Health

---

### Milestone 9: Data Portability & Resilience
> Users' data is local-only, so portability and backup are critical.

- [ ] **9.1 Data export**
  - Export all health data as JSON (full fidelity, re-importable)
  - JSON includes all four IndexedDB stores: `healthRecords`, `dailySummaries`, `imports`, `labResults`
  - Lab result PDFs included as base64-encoded blobs in the export
  - Every record retains full provenance: `sourcePlatform`, `sourceType` (original Apple Health / Health Connect identifier), `sourceDevice`, `importId`
  - The `imports` store is included so re-import recreates the full import history (which Apple Health export file each record came from, original file name, export date, date range)
  - Export as CSV (human-readable, per metric type — includes source platform and device columns)
  - Export runs entirely client-side (IndexedDB → download)
  - Version the export format (include a schema version field) for forward compatibility

- [ ] **9.2 Data import from backup**
  - Import previously exported JSON backup to restore complete state
  - Recreates all records with original provenance links intact — user sees the same import history, same source attribution per record
  - Merge with existing data: deduplicate based on `metricType + startTime + sourcePlatform + sourceDevice`
  - Handle schema version differences (migrate older export formats if needed)
  - Useful for: new device, cleared browser data, switching browsers, migrating between machines

- [ ] **9.3 Storage warnings and management**
  - Display current IndexedDB storage usage in settings
  - Warn user if approaching browser storage limits
  - Warn user that clearing browser data will delete health data
  - Option to delete specific imports or all data with confirmation
  - Recommend periodic JSON backup exports

- [ ] **9.4 Cross-device sync (future consideration)**
  - Document the architecture for optional encrypted cloud sync (user-controlled encryption key)
  - This is a future feature — for Phase 1, data is single-device only
  - The sync design should ensure the server never has access to decryption keys

---

### Milestone 10: International Patient Summary (IPS) Export
> Users can generate a standardized clinical health summary from their data — entirely client-side.

- [ ] **10.1 FHIR resource generation**
  - Install `@types/fhir` for TypeScript type definitions (FHIR R4)
  - Implement `web/src/services/ips.ts` — client-side IPS Bundle generator
  - Generate FHIR `Patient` resource (user enters name at export time — not stored)
  - Generate FHIR `Observation` resources for vital signs from `healthRecords` / `dailySummaries`:
    - Heart rate, resting heart rate, blood pressure, SpO2, respiratory rate, body weight
    - Each coded with LOINC (primary) and SNOMED CT (supplementary) from `METRIC_CODING`
    - Use most recent values and/or summary over a user-selected time range
  - Generate FHIR `Observation` resources for lab results from `labResults.structuredValues`:
    - Each coded with its `loincCode`
    - Include reference ranges and flags where available
  - Generate FHIR `Composition` resource with standard IPS sections:
    - **Vital Signs** (LOINC 8716-3) — populated from health records
    - **Results** (LOINC 30954-2) — populated from lab results
    - **Medication Summary** (LOINC 10160-0) — "no information available" (app doesn't track meds)
    - **Allergies and Intolerances** (LOINC 48765-2) — "no information available"
    - **Problem List** (LOINC 11450-4) — "no information available"
  - Assemble FHIR `Bundle` (type: "document") containing all resources
  - Validate Bundle structure against IPS profile constraints

- [ ] **10.2 IPS JSON export**
  - Export button on a dedicated "Patient Summary" page
  - User enters their name (for the Patient resource) — shown clearly that this will be in the file
  - User selects time range for vital signs data (e.g., last 30 days, last 6 months)
  - User selects which lab results to include (checkboxes)
  - Preview of what will be included before export
  - Download the FHIR IPS Bundle as a `.json` file — entirely client-side

- [ ] **10.3 IPS PDF export**
  - Generate a human-readable PDF summary from the IPS Bundle data using `pdfmake`
  - Sections: patient info, vital signs table, lab results table
  - Include reference ranges and flagged values for lab results
  - Clean, professional layout suitable for sharing with a healthcare provider
  - PDF generated entirely client-side — no server involvement
  - Download as `.pdf` file

- [ ] **10.4 IPS UI**
  - "Patient Summary" page accessible from sidebar/settings
  - Explanation of what IPS is and how it can be used ("share with your doctor", "cross-border care")
  - Clear privacy messaging: "Your name is only included in the exported file — it is not stored or sent to our servers."
  - Export format selector: JSON (for EHR systems) or PDF (for sharing with providers)
  - Preview mode: see the rendered summary before exporting

---

### Milestone 11: Polish & Production Readiness
> Make the app production-quality.

- [ ] **11.1 Performance optimization**
  - Virtual scrolling for large data tables (workout log)
  - Lazy loading for chart components
  - IndexedDB query optimization: use cursor-based pagination for large result sets
  - Web Worker for heavy aggregation to keep UI responsive
  - Memoize expensive chart data transformations

- [ ] **11.2 Testing**
  - Unit tests for parsers, normalizers, and aggregation logic
  - Unit tests for LLM prompt construction — verify no PII leakage in both Standard and Enhanced modes
  - Unit tests for Enhanced mode: verify per-query consent reset, verify excluded fields are never sent
  - Integration tests for server API endpoints (auth, LLM proxy)
  - E2E tests for critical flows: sign up → import → view dashboard → upload lab results → ask LLM (both modes)
  - Test with sample Apple Health export files of varying sizes
  - Test IndexedDB operations with large datasets
  - Unit tests for IPS Bundle generation: validate FHIR structure, correct LOINC/SNOMED coding, required sections present
  - Test IPS export with various data combinations (vital signs only, lab results only, both, empty data)
  - i18n completeness check: verify all English keys have French translations (automated CI check)
  - E2E test for language switching: verify full app renders correctly in French (no missing keys, correct number/date formatting)

- [ ] **11.3 Documentation and legal**
  - API documentation via Swagger UI (for the thin server API)
  - User-facing help/FAQ page
  - Privacy policy page: clearly explain that health data never leaves the device, what the LLM sees, what the server stores (only auth + preferences)
  - Terms of service
  - "Not medical advice" legal disclaimer

- [ ] **11.4 Deployment**
  - Dockerized production build (server only — web is static assets)
  - Static hosting for the web SPA (Cloudflare Pages, Vercel, or Netlify)
  - Server deployment for auth + LLM proxy (Railway, Fly.io, or similar)
  - Environment configuration (env vars for DB, Anthropic API key)
  - Logging and error monitoring (server-side only — no health data in logs)

---

## Phase 2: iOS App (Future)

- Native Swift app with HealthKit integration
- Real-time sync (no manual export needed) — data stays on device
- Background refresh for daily summaries
- Push notifications for weekly insights
- On-device CoreData/SQLite for health data storage
- Same LLM proxy API as the web app (server still never sees health data)

## Phase 3: Android App (Future)

- Native Kotlin app with Health Connect Jetpack SDK
- Same on-device storage approach as iOS
- Replaces the manual JSON import from Phase 1 Milestone 7

---

## Architecture Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| **Health data stored client-side only** | Core privacy principle — the server never sees health records. Users own their data completely. |
| **IndexedDB via Dexie.js** | Mature, well-supported client-side storage with good query capabilities. Dexie.js provides a clean async API, compound indexes, and bulk operations. |
| **Web Workers for parsing** | Apple Health exports can be 2+ GB. Parsing must not block the UI thread. Workers also provide memory isolation. |
| **Server as thin LLM proxy** | Server exists only for auth and LLM API key management. Health data never touches the server. The server cannot be a liability for health data breaches because it has no health data. |
| **Client-side prompt construction** | The client knows the data and constructs the prompt. The server just forwards it. This means even if the server is compromised, health data is not exposed (beyond the anonymized aggregates in transit). |
| **Monorepo with Turborepo** | Shared types between server and client prevent drift; single repo simplifies development. |
| **Fastify over Express** | Faster, built-in schema validation, better TypeScript support, plugin architecture. |
| **Drizzle ORM** | Type-safe, lightweight, SQL-like API. Only used for the simple auth/prefs schema. |
| **Open mHealth-inspired internal schema** | Lightweight standard designed for consumer health data; provides a clean normalization target for both Apple Health and Health Connect. |
| **Recharts + ECharts** | Recharts for simple, idiomatic React charts; ECharts for complex overlays and large datasets. |
| **Tiered LLM privacy (Standard/Enhanced)** | Default mode sends only aggregates — maximum privacy. Enhanced mode lets users opt in to share more detail (lab values, granular metrics) for better answers, with per-query consent and full data preview. The user is always in control. |
| **Lab results as local PDFs** | Lab reports stored as binary blobs in IndexedDB. Text extracted client-side via pdf.js. No server involvement — the PDF never leaves the device unless the user explicitly opts into Enhanced LLM mode for specific values. |
| **SNOMED CT + LOINC coding** | All health metrics and lab results tagged with standard clinical codes. LOINC is primary (IPS requirement), SNOMED CT supplementary. Codes stored as a static lookup table in the shared package — not per-record in IndexedDB (avoids storage bloat). Enables clinically interoperable IPS export. |
| **Client-side IPS generation** | IPS FHIR Bundle generated entirely in the browser from local data. User enters name only at export time. Maps vital signs and lab results to standard IPS sections. Produces JSON (machine-readable) or PDF (human-readable). No server involvement. |
| **react-i18next for i18n** | De facto standard for React internationalization. Supports namespaced lazy loading (only load translation files for active route), plurals, interpolation, and TypeScript-safe keys. i18next-browser-languagedetector auto-detects user language. Starting with English and French; architecture supports adding languages by adding a new locale directory. |

## Development Order Rationale

Milestones are ordered to deliver value incrementally:
1. **Foundation** — can't build anything without this; includes client-side DB setup, SNOMED CT / LOINC coding tables, and i18n setup (so all subsequent UI work uses translation keys from the start)
2. **Auth** — needed before any user-specific features
3. **Apple Health Import** — the primary data source; most users will start here; all client-side
4. **Dashboard** — the core product; reads directly from local IndexedDB
5. **Trends** — extends the dashboard with deeper client-side analysis
6. **Lab Results** — adds a new data source (PDFs); builds the UI and extraction pipeline before LLM needs it; auto-assigns LOINC codes to extracted values
7. **LLM Insights** — the differentiator; tiered privacy model lets users choose between aggregated-only (Standard) and detailed (Enhanced) responses; lab results available as Enhanced context
8. **Google Health Connect** — second platform; same client-side pipeline, different parser
9. **Data Portability** — critical for a local-first app; users need backup and restore (including lab PDFs)
10. **IPS Export** — generates a standardized clinical summary (FHIR IPS) from local data; builds on the LOINC/SNOMED coding already in place; outputs JSON or PDF entirely client-side
11. **Polish** — production readiness, testing, deployment
