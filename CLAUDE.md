# Health Dashboard App

A privacy-first, platform-agnostic health data visualization and LLM-insights app. Users import Apple Health (XML) or Google Health Connect data; everything is processed and stored client-side.

**Phase 1**: Web app | **Phase 2**: iOS (HealthKit) | **Phase 3**: Android (Health Connect)

---

## Privacy Architecture — Core Principle

**Health data never leaves the user's device.** This constraint drives every architectural decision.

- All health data stored client-side in **IndexedDB** (Dexie.js); parsed in **Web Workers** — the server never sees raw records
- Server exists only for: authentication, user preferences, LLM proxy passthrough
- LLM receives only **anonymized, pre-aggregated summaries** — never raw records, never sub-daily timestamps, never PII
- No server-side health database. Users own their data; it lives in browser storage only.
- Data export is client-side (IndexedDB → JSON). Clearing browser data permanently deletes all health data — the app warns users and encourages periodic backups.

**What the server knows about health data: nothing.** The LLM proxy is a passthrough. It does not log, store, or inspect prompt contents.

---

## Tech Stack

**Backend** (thin): Node.js + TypeScript, Fastify, PostgreSQL (auth/prefs only), Drizzle ORM, Better Auth (magic-link), Anthropic Claude API proxy.

**Frontend** (all health data lives here): React 19 + TypeScript, Vite, TanStack Router + Query, Tailwind CSS v4, Recharts + Apache ECharts, Radix UI, Dexie.js (IndexedDB).

**Infra**: Turborepo monorepo, pnpm, Docker Compose (local dev), Vitest + Playwright, Biome.

**i18n**: `react-i18next`. Supported: `en` (source), `fr`. Translation files in `apps/web/src/locales/{lang}/{namespace}.json`. Namespaces: `common`, `auth`, `dashboard`, `import`, `insights`, `lab-results`, `settings`, `ips`.

---

## LLM Integration — Privacy Tiers & Health Safety

The user controls which tier is active **per query**.

### Standard Mode (default)
- Only aggregated summaries sent (averages, min/max, trends). Daily granularity max.
- No raw records, no PII, no lab values (categories only: "recent blood work available").
- User sees a preview of exactly what will be sent before each query.

### Enhanced Mode (explicit opt-in per query)
Requires: explicit toggle (defaults off), prominent warning ("This data will leave your device and be processed by a third-party AI service"), data preview with per-item deselection, per-query consent (does not carry over).

Can include: lab result values, granular metrics, longer time ranges, cross-metric context.
**Never includes** (even in Enhanced Mode): PII (name, DOB, email, address), device identifiers, GPS/location, timestamps below daily granularity.

### LLM System Prompt Constraints (non-negotiable)
- Health education only — **never** medical diagnosis
- **Never** suggest medications or treatments
- Always include "this is not medical advice" disclaimer
- Always encourage consulting a healthcare professional for concerns
- Only interpret data provided — never ask for more

---

## Clinical Coding — SNOMED CT & LOINC

All health data is tagged with standardized clinical codes for IPS export and interoperability.

- **LOINC** = primary coding for observations (vital signs, lab results) — required for IPS
- **SNOMED CT** = supplementary coding for richer clinical semantics
- Codes live in a static `METRIC_CODING` lookup in `packages/shared/src/coding/` — not stored per-record in IndexedDB
- **All codes must be verified against a local SNOMED CT terminology server (Snowstorm) during development**

### metricType → LOINC / SNOMED CT

| metricType | LOINC | SNOMED CT |
|---|---|---|
| `heart_rate` | 8867-4 | 364075005 |
| `resting_heart_rate` | 40443-4 | 444981005 |
| `hrv` | 80404-7 | *verify* |
| `blood_pressure` | 85354-9 | 75367002 |
| `blood_pressure_systolic` | 8480-6 | 271649006 |
| `blood_pressure_diastolic` | 8462-4 | 271650006 |
| `oxygen_saturation` | 2708-6 | 431314004 |
| `respiratory_rate` | 9279-1 | 86290005 |
| `body_mass` | 29463-7 | 27113001 |
| `body_fat` | 41982-0 | *verify* |
| `step_count` | 55423-8 | *verify* |
| `active_energy` | 41981-2 | *verify* |
| `distance` | 41953-1 | *verify* |
| `sleep_session` | 93832-4 | 248263006 |
| `flights_climbed` | *none* | *verify* |

### Common Lab LOINC Codes

| Test | LOINC |
|---|---|
| Total Cholesterol | 2093-3 |
| HDL | 2085-9 |
| LDL | 2089-1 |
| Triglycerides | 2571-8 |
| HbA1c | 4548-4 |
| Fasting Glucose | 1558-6 |
| TSH | 3016-3 |
| Free T4 | 3024-7 |
| Free T3 | 3051-0 |
| Hemoglobin | 718-7 |
| WBC | 6690-2 |
| RBC | 789-8 |
| Platelets | 777-3 |

---

## IPS (International Patient Summary) Export

FHIR R4 Bundle generated entirely client-side (`web/src/services/ips.ts`). Never touches the server.

Included: vital signs (HR, BP, SpO2, respiratory rate, body weight) → section 8716-3; lab results → section 30954-2.
Not included: sleep, activity, workouts (not clinical essentials per IPS spec).

Required sections the app cannot populate (Medications, Allergies, Problem List) use "no information available" entries per spec.

Export formats: FHIR JSON + PDF (via `pdfmake`). Patient name entered at export time — not stored.

---

## Key Conventions

- All dates/times: ISO 8601 UTC
- API responses: camelCase; DB columns: snake_case; IndexedDB fields: camelCase
- Health metric values stored in SI/metric units internally
- Zod for runtime validation (client + server); Problem Details (RFC 9457) for error responses
- **Never hardcode user-facing strings** — always use `useTranslation()` with namespace. Key format: `namespace.section.key` (e.g., `dashboard.card.stepsToday`)
- **Never hardcode number/date formats** — always use `Intl.NumberFormat` / `Intl.DateTimeFormat` with active locale
- Apple Health XML parsed in Web Worker using `sax` + streaming (`File.stream()`) — never load full file into memory; batch 1000 records to IndexedDB

## Design System (summary)
- Tailwind CSS v4, Inter font, Radix UI primitives, Lucide icons
- Category colors: Activity=blue-500, Heart=rose-500, Sleep=indigo-500, Body=amber-500, Vitals=emerald-500, Labs=violet-500, Workouts=orange-500
- Cards: `rounded-xl border shadow-sm p-6`; hero values: `text-3xl font-bold tabular-nums`
- Always skeleton loaders (never blank pages); always meaningful empty states with CTA

---

## Commands

```bash
pnpm install
docker compose up -d && pnpm dev   # local dev
pnpm test && pnpm test:e2e
pnpm lint && pnpm format
pnpm --filter @health-app/db migrate
pnpm build
```
