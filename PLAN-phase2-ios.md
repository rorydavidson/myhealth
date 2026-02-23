# Health Dashboard — Phase 2: iOS App

## Overview

Phase 2 is a native Swift iOS app that integrates directly with HealthKit, eliminating the manual export step required in Phase 1. Health data still never leaves the device — all storage, aggregation, and computation happens on-device using Swift Data / Core Data, and the same thin server from Phase 1 handles auth and LLM proxying.

The app shares the same visual identity and feature set as the web app, implemented natively in SwiftUI for a platform-appropriate feel.

---

## Guiding Principles (same as Phase 1)

1. **Health data never leaves the device.** HealthKit data is read directly and stored on-device in Swift Data. The server never receives raw health records.
2. **Privacy by architecture.** LLM queries send only client-computed anonymised summaries, never raw records. The user sees exactly what will be sent before every query.
3. **Native-first UX.** SwiftUI, not a web view. Respect iOS Human Interface Guidelines while maintaining the visual identity from Phase 1.
4. **Shared server.** The same Fastify server (auth, preferences, LLM proxy) serves both the web app and the iOS app — no new backend work required beyond any iOS-specific API endpoints.
5. **Parity with Phase 1.** Every feature available in the web app is available in the iOS app — including all IPS sections (vital signs, lab results, conditions, medications, allergies).

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | Swift 6 | Strict concurrency (`Sendable`, actors) |
| UI framework | SwiftUI | Minimum deployment: iOS 17 |
| Health data | HealthKit | Native framework — no manual export |
| Local storage | Swift Data | Replaces Dexie.js / IndexedDB |
| Networking | `URLSession` + `async/await` | Auth API, LLM proxy |
| Charts | Swift Charts | Native framework (iOS 16+) |
| Auth | Better Auth (same server) | Session cookie via `HTTPCookieStorage` |
| LLM | Same `/api/llm/query` proxy | Client constructs prompt on-device |
| PDF generation | PDFKit + UIKit | Client-side, no server involvement |
| FHIR types | Custom Swift structs | Mirror `@types/fhir` from Phase 1 |
| i18n | `String(localized:)` + `.xcstrings` | String Catalogs (Xcode 15+) |
| Testing | XCTest + Swift Testing | Unit + UI tests |
| Package manager | Swift Package Manager | Dependencies declared in `Package.swift` |
| CI | GitHub Actions (macOS runner) | Build, test, lint (SwiftLint) |

---

## Project Structure

```
health-app/
├── apps/
│   ├── server/                   # Existing — no changes for Phase 2
│   ├── web/                      # Existing — no changes for Phase 2
│   └── ios/                      # New — Swift package / Xcode project
│       ├── HealthDashboard.xcodeproj
│       ├── HealthDashboard/
│       │   ├── App/
│       │   │   ├── HealthDashboardApp.swift     # @main entry point
│       │   │   └── AppDelegate.swift
│       │   ├── Core/
│       │   │   ├── Auth/                        # Session management, login/logout
│       │   │   ├── API/                         # URLSession client, endpoints
│       │   │   ├── Storage/                     # Swift Data schema + migrations
│       │   │   ├── HealthKit/                   # HealthKit query wrappers
│       │   │   ├── Aggregation/                 # Daily summary computation
│       │   │   ├── LLM/                         # Prompt construction, privacy tiers
│       │   │   ├── IPS/                         # FHIR IPS bundle generation
│       │   │   └── Export/                      # JSON + PDF export
│       │   ├── Features/
│       │   │   ├── Dashboard/
│       │   │   ├── Workouts/
│       │   │   ├── Trends/
│       │   │   ├── LabResults/
│       │   │   ├── Conditions/
│       │   │   ├── Medications/
│       │   │   ├── Allergies/
│       │   │   ├── Insights/
│       │   │   ├── PatientSummary/
│       │   │   ├── Import/
│       │   │   ├── Settings/
│       │   │   └── Auth/
│       │   ├── Components/                      # Reusable SwiftUI views
│       │   │   ├── Charts/
│       │   │   ├── Cards/
│       │   │   └── Common/
│       │   ├── Resources/
│       │   │   ├── Localizable.xcstrings        # String Catalog (EN + FR)
│       │   │   └── Assets.xcassets
│       │   └── Info.plist
│       └── HealthDashboardTests/
│           ├── AggregationTests.swift
│           ├── NormalizeTests.swift
│           ├── LLMPromptTests.swift
│           └── IPSBundleTests.swift
└── packages/
    └── shared/                   # Existing — clinical codes referenced; no Swift port needed
```

---

## Milestone 12: iOS Project Foundation

> Xcode project, SwiftUI shell, HealthKit entitlement, Swift Data schema, and API client.

- [ ] **12.1 Xcode project setup**
  - Create `apps/ios/` as a Swift Package or Xcode project
  - Minimum deployment target: iOS 17.0
  - Swift 6 language mode, strict concurrency enabled
  - SwiftLint configured (`.swiftlint.yml` at root of `apps/ios/`)
  - Turborepo `turbo.json` updated: add `ios:build`, `ios:test`, `ios:lint` tasks (macOS runners only — gated in CI)
  - `.gitignore` additions for Xcode derived data, `.xcuserstate`, `*.xcworkspace/xcuserdata/`

- [ ] **12.2 App shell and navigation**
  - `@main` entry point with SwiftUI `App` struct
  - Root navigation: `TabView` with five tabs — Dashboard, Insights, Import, Summary, Settings
  - Each tab backed by its own `NavigationStack`
  - Tab bar icons from SF Symbols; category accent colours matching Phase 1 design tokens (activity=blue, heart=rose, sleep=indigo, body=amber, vitals=emerald)
  - Dark mode: automatic via `@Environment(\.colorScheme)`, same colour semantics as Phase 1
  - App-wide `@Observable` `AppState` class: current user session, preferences, HealthKit authorisation status

- [ ] **12.3 HealthKit entitlement and authorisation**
  - `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription` in `Info.plist`
  - `HealthKit` capability enabled in Xcode project
  - `HealthKitManager` actor: wraps `HKHealthStore`, requests authorisation, exposes typed async query methods
  - Authorisation request on first launch: present a pre-authorisation explanation screen before the system prompt
  - Graceful handling if HealthKit unavailable (iPad / Simulator): show a message, allow the rest of the app to function with any manually entered data
  - Required HealthKit read types (Phase 2 — same metrics as Phase 1 web app):
    - Activity: `stepCount`, `distanceWalkingRunning`, `activeEnergyBurned`, `flightsClimbed`
    - Heart: `heartRate`, `restingHeartRate`, `heartRateVariabilitySDNN`
    - Body: `bodyMass`, `bodyFatPercentage`
    - Vitals: `oxygenSaturation`, `bloodPressureSystolic`, `bloodPressureDiastolic`, `respiratoryRate`
    - Sleep: `sleepAnalysis`
    - Workouts: `workoutType` (via `HKWorkout` queries)

- [ ] **12.4 Swift Data schema**
  - Define `@Model` classes mirroring the Phase 1 IndexedDB schema:
    - `HealthRecord` — `id`, `metricType`, `value`, `unit`, `startTime`, `endTime`, `sourcePlatform`, `sourceDevice`, `sourceType`, `importId`, `metadata`
    - `DailySummary` — `id` (`{metricType}:{date}`), `metricType`, `date`, `avg`, `min`, `max`, `sum`, `count`
    - `LabResult` — `id`, `fileName`, `date`, `category`, `pdfData`, `extractedText`, `structuredValues`, `notes`, `createdAt`
    - `ClinicalCondition` — `id`, `snomedCode`, `snomedDisplay`, `status`, `onsetDate`, `notes`, `createdAt`
    - `Medication` — `id`, `snomedCode`, `snomedDisplay`, `dose`, `startDate`, `endDate`, `status`, `reason`, `notes`, `createdAt`
    - `Allergy` — `id`, `snomedCode`, `snomedDisplay`, `type`, `category`, `criticality`, `reaction`, `onsetDate`, `notes`, `createdAt`
    - `Import` — `id`, `platform`, `fileName`, `exportDate`, `startedAt`, `completedAt`, `recordCount`, `status`, `dateRangeStart`, `dateRangeEnd`
  - `ModelContainer` configured with `ModelConfiguration(isStoredInMemoryOnly: false)` in production, in-memory for tests
  - Schema migrations handled via `VersionedSchema` and `SchemaMigrationPlan`

- [ ] **12.5 API client**
  - `APIClient` actor wrapping `URLSession` — shared singleton via dependency injection
  - Base URL read from `Info.plist` (different values per scheme: Debug → `http://localhost:3001`, Release → production URL)
  - Automatic `Content-Type: application/json` and `Accept: application/json` headers
  - Session cookie forwarded automatically via `HTTPCookieStorage.shared`
  - Typed request/response models matching server OpenAPI spec (mirroring Phase 1 TypeScript types)
  - `APIError` enum: `.unauthorised` (401 → trigger logout), `.serverError(Int, String)`, `.networkError(Error)`, `.decodingError(Error)`
  - Retry logic: 1 automatic retry on network error, no retry on 4xx

- [ ] **12.6 Design system**
  - `DesignTokens.swift` — category colours as `Color` values mirroring Phase 1 palette:
    - `activity`: `Color(red: 0.231, green: 0.510, blue: 0.965)` (blue-500)
    - `heart`: `Color(red: 0.957, green: 0.247, blue: 0.369)` (rose-500)
    - `sleep`: `Color(red: 0.388, green: 0.400, blue: 0.945)` (indigo-500)
    - `body`: `Color(red: 0.961, green: 0.620, blue: 0.043)` (amber-500)
    - `vitals`: `Color(red: 0.063, green: 0.725, blue: 0.506)` (emerald-500)
    - `workouts`: `Color(red: 0.976, green: 0.451, blue: 0.086)` (orange-500)
    - `labResults`: `Color(red: 0.545, green: 0.361, blue: 0.965)` (violet-500)
  - `MetricCard` view: rounded rectangle, category accent, hero number in `largeTitle` weight, unit label in caption
  - `SectionHeader` view: small caps label with category colour underline
  - `EmptyStateView`: SF Symbol icon + title + body + optional CTA button
  - `SkeletonView`: redacted placeholder matching target content shape (`redacted(reason: .placeholder)`)

---

## Milestone 13: Authentication

> Sign in/out flow, session persistence, user preferences sync.

- [ ] **13.1 Auth screens**
  - `LoginView`: email + password fields, "Sign in" primary button, link to sign up and password reset
  - `SignUpView`: name, email, password, confirm password, "Create account" button
  - `ForgotPasswordView`: email field, "Send reset link" button, success confirmation
  - All auth screens: full-screen, no tab bar, app wordmark centred above the form — consistent with Phase 1 web auth pages
  - Form validation: inline error messages on blur, primary button disabled until valid
  - Loading states: `ProgressView` inside buttons during network requests

- [ ] **13.2 Session management**
  - `AuthManager` actor: wraps login/signup/logout API calls, persists session cookie via `HTTPCookieStorage`
  - Session validated on app launch via `GET /api/auth/session`
  - If session invalid or expired: clear local session state, redirect to login
  - Keychain storage for long-lived session token (not UserDefaults — sensitive)
  - `@Observable` session state propagated app-wide via environment

- [ ] **13.3 User preferences**
  - `GET /api/preferences` on login — load unit preference (metric/imperial), language, theme
  - Unit preference: stored locally in `UserDefaults` for immediate UI use; synced from server on login
  - Language: respects iOS system language by default; manual override stored server-side and applied on launch via `Bundle` locale override
  - Theme: `light` / `dark` / `system` — applied via `preferredColorScheme` on root view
  - Settings screen: display name, unit preference, language picker, theme picker — changes sync to server via `PATCH /api/preferences`

---

## Milestone 14: HealthKit Integration & Background Sync

> Read data continuously from HealthKit — no manual export required. The core differentiator of the iOS app.

- [ ] **14.1 Initial HealthKit data load**
  - On first authorisation: query all available HealthKit data for the past 5 years
  - `HKSampleQuery` with a date predicate for historical load
  - Process in batches of 1000 records to avoid memory pressure
  - Normalise each `HKSample` into a `HealthRecord` using the same metric type mapping as Phase 1:
    - `HKQuantityTypeIdentifier.stepCount` → `step_count`
    - `HKQuantityTypeIdentifier.heartRate` → `heart_rate`
    - `HKCategoryTypeIdentifier.sleepAnalysis` → `sleep_session`
    - (full mapping for all Phase 1 metrics)
  - Unit conversion to SI: miles → km, lbs → kg, Fahrenheit → Celsius (where applicable)
  - Store `sourcePlatform = "apple_health"`, `sourceDevice` from `HKSource.name`, `sourceType` from `HKSampleType.identifier`
  - Persist to Swift Data in background actor; progress communicated via `AsyncStream` to UI
  - Create a synthetic `Import` record tracking the initial load (platform, record count, date range, completion time)
  - Compute daily summaries after load completes

- [ ] **14.2 HealthKit observer queries (real-time updates)**
  - `HKObserverQuery` registered for each metric type after initial load
  - When HealthKit notifies of new data: run an `HKAnchoredObjectQuery` to fetch only new/changed samples since last anchor
  - Store new samples in Swift Data, update affected daily summaries incrementally
  - Anchor stored in `UserDefaults` per metric type — survives app restarts
  - Deduplication: check for existing `HealthRecord` with same `sourceType + startTime + sourceDevice` before inserting

- [ ] **14.3 Background delivery**
  - Enable HealthKit background delivery for all observed metric types (`HKHealthStore.enableBackgroundDelivery`)
  - Background `URLSessionConfiguration` — not needed (all processing is on-device); only the LLM proxy needs network
  - `BGAppRefreshTask` scheduled daily: recompute daily summaries, generate weekly insight if new data available
  - Background task registered in `Info.plist` (`BGTaskSchedulerPermittedIdentifiers`)

- [ ] **14.4 HealthKit workout queries**
  - `HKWorkoutQuery` to fetch workout sessions
  - Map `HKWorkoutActivityType` to internal workout type strings (matching Phase 1 `workoutActivityType` mapping)
  - Store duration (`workout.duration`), distance (`HKQuantityType.distanceWalkingRunning` statistics), active energy (`HKQuantityType.activeEnergyBurned` statistics) in `metadata`
  - Display in Workouts tab (same data as Phase 1 Workouts page)

- [ ] **14.5 Sleep data handling**
  - `HKCategoryTypeIdentifier.sleepAnalysis` returns individual stage samples (awake, core, deep, REM — iOS 16+)
  - Group overlapping samples into sessions (gap < 30 minutes = same session)
  - Store total session duration as `value`, store stage breakdown in `metadata` as `{ awake, core, deep, rem }` (minutes)
  - Daily summary: `sum` = total sleep time; `min`/`max` = shortest/longest session that day

---

## Milestone 15: Dashboard

> The core visualisation screen — mirrors the Phase 1 web dashboard, built natively in SwiftUI with Swift Charts.

- [ ] **15.1 Dashboard layout**
  - `ScrollView` with `LazyVStack` sections: Overview (snapshot cards), Activity, Heart, Sleep, Body, Vitals
  - Date range picker: segmented control at the top (7d, 30d, 90d, 1y, All) — updates all charts simultaneously via a shared `@State` or `@Observable` view model
  - Pull-to-refresh: reload daily summaries from Swift Data (not from HealthKit — summaries are kept up to date by observer queries)
  - Navigation bar: large title "Dashboard", settings gear icon leading to Settings

- [ ] **15.2 Snapshot cards (Overview section)**
  - `LazyVGrid` with 2-column layout: today's steps, resting heart rate, last night's sleep, weight
  - `MetricCard` component: category colour, SF Symbol icon, hero number, unit, date label
  - Values read from `DailySummary` for today (or most recent day with data)
  - Tap a card → navigate to the full metric detail view

- [ ] **15.3 Chart cards**
  - `ChartCard` component: title, category colour accent, `Chart` (Swift Charts) — mirrors Phase 1 `ChartCard`
  - Chart types:
    - **Bar** (`BarMark`): steps, distance, active energy, sleep duration
    - **Line** (`LineMark`): resting HR, HRV, weight, body fat, SpO₂, respiratory rate
    - **Area** (`AreaMark` with gradient fill): heart rate (with `RuleMark` for min/max range)
  - Smooth interpolation: `.interpolationMethod(.catmullRom)` for line/area charts
  - Gradient fill: `LinearGradient` from category colour at 20% opacity to clear — matches Phase 1
  - Tooltips: `chartOverlay` with a `DragGesture` detecting the nearest data point; shows a callout with date and value
  - Animated transitions: `.animation(.easeInOut(duration: 0.3), value: dateRange)` when date range changes
  - Skeleton: `redacted(reason: .placeholder)` overlaid on a grey `RoundedRectangle` while data loads

- [ ] **15.4 Metric detail views**
  - Tapping a chart card or snapshot card pushes a full-screen detail view
  - Larger chart (takes 40% of screen height), full date range selector
  - Statistics summary below chart: current, 7-day average, 30-day average, all-time min/max
  - Data table (accessible alternative to chart): date + value rows in a `List`

- [ ] **15.5 Workout log**
  - Separate "Workouts" section in dashboard or dedicated tab
  - Monthly frequency chart: `BarChart` grouped by month
  - `List` of workouts: type icon (SF Symbol), date, duration, distance, calories
  - Filter by workout type: `Picker` in toolbar
  - Row tap → workout detail sheet: map placeholder (no GPS in Phase 1), heart rate chart if available

---

## Milestone 16: Trends & Correlations

> Client-side trend analysis — same algorithms as Phase 1, implemented in Swift.

- [ ] **16.1 Trend computation**
  - `TrendService` actor: reads `DailySummary` from Swift Data, computes trends client-side
  - Weekly comparison: this week vs last week for each metric (percentage delta)
  - Trend direction: improving / stable / declining based on linear regression slope over the selected period
  - All computation on-device; no server involvement

- [ ] **16.2 Trends screen**
  - `ScrollView` with metric trend cards: sparkline mini-chart (Swift Charts, compact height), trend arrow, percentage delta, "this week vs last week" label
  - Trend arrow colour: emerald (improving), rose (declining), neutral (stable) — matching Phase 1
  - Significant changes (>10%) highlighted with a subtle amber border on the card

- [ ] **16.3 Correlation explorer**
  - Two metric pickers (using `Picker` or custom bottom sheet selector)
  - Dual-axis line chart: two `LineMark` series on independent Y axes, each in its category colour
  - Pearson correlation coefficient computed client-side from aligned daily summaries
  - Correlation strength badge: strong (emerald), moderate (amber), weak (neutral)
  - Scatter plot: `PointMark` with one metric on X axis, the other on Y — colour by density

---

## Milestone 17: Lab Results

> PDF lab reports stored on-device, text extracted natively, visualised over time.

- [ ] **17.1 Lab result import**
  - File picker (`fileImporter` modifier) accepting PDF files
  - PDF stored as `Data` in Swift Data `LabResult.pdfData` — never uploaded to server
  - User enters date of test and selects category (blood panel, lipid panel, thyroid, metabolic, other)
  - Privacy banner: "Your lab results stay on this device."

- [ ] **17.2 Client-side PDF text extraction**
  - `PDFDocument` (PDFKit) for text extraction — no network calls, fully on-device
  - Extract raw text via `PDFPage.string` for each page
  - Best-effort structured value extraction in Swift: regex patterns matching common lab report formats (test name, value, unit, reference range, flag)
  - Auto-assign LOINC codes from a static Swift dictionary mirroring `LAB_CODING` from Phase 1 shared package
  - User review screen: extracted values displayed as editable rows; user can correct values and LOINC assignments

- [ ] **17.3 Lab results viewer**
  - List screen: date, category, file name, key values (total cholesterol, A1C, etc.)
  - Detail screen: `PDFKitView` (UIViewRepresentable wrapping `PDFView`) alongside extracted structured values
  - Timeline view: track a specific lab value across multiple reports (Swift Charts line chart)

---

## Milestone 18: Conditions, Medications & Allergies

> Reproduce the Phase 1 clinical data entry pages natively. Same SNOMED CT search, same FHIR structures.

- [ ] **18.1 SNOMED CT search**
  - `SnomedService` actor: replicates the Phase 1 `searchSnomedConditions`, `searchSnomedMedications`, `searchSnomedSubstances` logic in Swift
  - Same FHIR ValueSet `$expand` API calls (`URLSession` GET to `VITE_FHIR_TERMINOLOGY_URL`)
  - Same ECL constraints:
    - Conditions: `< 404684003 |Clinical finding|`
    - Medications: `< 373873005 |Pharmaceutical / biologic product|`
    - Allergens: `< 105590001 |Substance|` AND `< 473010000 |Hypersensitivity condition|` (parallel, merged)
  - Response decoded into `SnomedConcept` struct: `code`, `display`, `synonyms`
  - Debounced search: 300ms after last keystroke

- [ ] **18.2 Conditions**
  - `ConditionsView`: `List` of `ClinicalCondition` records, "Add condition" toolbar button
  - `AddConditionView`: search field with live SNOMED results, status picker (Active/Resolved/Inactive), onset date picker, notes text field
  - `ConditionRow`: SNOMED display, status badge (emerald/neutral/amber), onset date
  - Swipe-to-delete with confirmation alert

- [ ] **18.3 Medications**
  - `MedicationsView` + `AddMedicationView` + `MedicationRow`
  - Same structure as Conditions; SNOMED medication search
  - Additional fields: dose (text), start date, end date (optional = ongoing), status, reason
  - Status badge colours: active=emerald, stopped=neutral, on-hold=amber

- [ ] **18.4 Allergies**
  - `AllergiesView` + `AddAllergyView` + `AllergyRow`
  - SNOMED allergen search (dual hierarchy: substance + hypersensitivity condition)
  - Additional fields: type (allergy/intolerance), category (food/medication/environment/biologic), criticality, reaction (text), onset date
  - Criticality badge colours: high=rose, low=neutral, unable-to-assess=amber

---

## Milestone 19: LLM Insights

> Same privacy-tiered AI chat as Phase 1 — prompt constructed on-device, server is a passthrough.

- [ ] **19.1 On-device prompt construction**
  - `LLMService` actor: mirrors Phase 1 `web/src/services/llm.ts` in Swift
  - Standard mode: reads `DailySummary` records from Swift Data, computes anonymised aggregates
    - No raw records, no sub-daily timestamps, no PII, no device names
    - Daily granularity maximum
  - Enhanced mode: can include specific lab values and granular daily metrics — same rules as Phase 1
  - Constructs full prompt string including health context and user question
  - Returns `(prompt: String, dataSentPreview: String)` — preview shown to user before sending

- [ ] **19.2 Streaming LLM response**
  - `POST /api/llm/query` with the constructed prompt
  - Server-Sent Events (SSE) streaming: `URLSession.bytes(for:)` reads the stream incrementally
  - `AsyncStream<String>` exposed to the view layer — each chunk appended to the displayed response
  - Typing indicator (animated ellipsis) while first chunk arrives

- [ ] **19.3 Insights UI**
  - Chat-style `ScrollView` with message bubbles: user messages right-aligned (category colour background), AI responses left-aligned (neutral card)
  - Privacy mode indicator: persistent pill at top — "Standard" (emerald) or "Enhanced" (amber)
  - "Data sent" collapsible panel: monospace text in a neutral card; amber border in Enhanced mode
  - Quick-ask chips: horizontal `ScrollView` of pill buttons — "How was my sleep this week?", "Am I getting enough exercise?", "What do my latest lab results mean?"
  - Enhanced mode toggle: `Toggle` with amber warning banner; per-query consent (resets after send)
  - "Not medical advice" disclaimer below each AI response (caption, neutral colour)
  - Conversation history stored in Swift Data `InsightMessage` model — not on server

- [ ] **19.4 Weekly summary card**
  - Auto-generated weekly summary on the dashboard home screen
  - Triggered by `BGAppRefreshTask`: if new data since last summary, send Standard-mode prompt, cache response in Swift Data
  - Displayed as a card below the snapshot cards on the Dashboard tab
  - "Regenerate" button for manual refresh

---

## Milestone 20: International Patient Summary (IPS)

> Client-side FHIR R4 IPS Bundle generation — same five sections as Phase 1, fully on-device.

- [ ] **20.1 FHIR model layer (Swift)**
  - Swift structs mirroring FHIR R4 resources: `FHIRBundle`, `FHIRComposition`, `FHIRPatient`, `FHIRObservation`, `FHIRCondition`, `FHIRMedicationStatement`, `FHIRAllergyIntolerance`
  - `Codable` conformance for JSON encoding
  - `LOINC` and `SNOMED` coding enums with raw values matching Phase 1 `METRIC_CODING` table

- [ ] **20.2 IPS bundle generation**
  - `IPSService` actor: mirrors Phase 1 `web/src/services/ips.ts`
  - Reads from Swift Data: `DailySummary` (vital signs), `LabResult.structuredValues` (results), `ClinicalCondition`, `Medication`, `Allergy`
  - Generates all five required IPS sections:
    - **Vital Signs** (LOINC 8716-3): `HKObservation` resources for HR, resting HR, BP, SpO₂, respiratory rate, body weight
    - **Results** (LOINC 30954-2): one `Observation` per structured lab value with its LOINC code
    - **Medication Summary** (LOINC 10160-0): `MedicationStatement` resources or `emptyReason` if none
    - **Allergies and Intolerances** (LOINC 48765-2): `AllergyIntolerance` resources or `emptyReason` if none
    - **Problem List** (LOINC 11450-4): `Condition` resources or `emptyReason` if none
  - `FHIRBundle` assembled with `urn:uuid:` fullUrls — no server calls

- [ ] **20.3 FHIR JSON export**
  - `JSONEncoder` with `.iso8601` date strategy encodes the `FHIRBundle`
  - User enters name (for `FHIRPatient` — not stored)
  - Date range picker for vital signs
  - Lab result multi-select: `List` with checkboxes
  - Preview: `List` showing what will be included in each section
  - Export via `ShareLink` — iOS share sheet; user chooses Files, AirDrop, email, etc.

- [ ] **20.4 PDF generation (PDFKit)**
  - `PDFContext` (UIGraphics PDF context) for programmatic layout — or `UIHostingController` → `UIGraphicsImageRenderer` to capture SwiftUI views as PDF pages
  - Sections: patient info header, Vital Signs table, Lab Results table, Medications table, Allergies table, Problem List table
  - Each table: `UITableView`-style layout with alternating row fills
  - Footer on each page: "Generated by Health Dashboard — Not medical advice"
  - Export via `ShareLink`

- [ ] **20.5 Patient Summary screen**
  - Dedicated tab or section in Settings
  - Explanation card: what IPS is, when to use it
  - Form: name field, time range picker, lab result selector
  - Preview section (mirrors Phase 1 Patient Summary preview)
  - Two export buttons: "Export FHIR JSON" and "Export PDF"

---

## Milestone 21: Data Portability

> Backup, restore, and cross-device migration — critical for a local-first app.

- [ ] **21.1 JSON export**
  - `ExportService` actor: encodes all Swift Data models to JSON
  - Schema matches Phase 1 export format — compatible with Phase 1 web app import (future milestone: web app can import from iOS backup and vice versa)
  - Lab PDFs included as Base64-encoded strings in the JSON
  - Export via `ShareLink` (Files, AirDrop, iCloud Drive)
  - Export version field: `"exportVersion": 2` (same versioning as Phase 1)

- [ ] **21.2 JSON import**
  - File picker accepting `.json` files
  - Decode and validate export format version
  - Merge strategy: skip records that already exist (same `id`); insert new ones
  - Progress indicator: `ProgressView` with record count
  - Useful for: restoring from web app backup, migrating between iPhones

- [ ] **21.3 iCloud backup consideration**
  - Health data in Swift Data is automatically excluded from iCloud backup by default (set `ModelConfiguration.cloudKitDatabase = .none` and ensure the store file is in a non-backed-up directory)
  - This is intentional — the app's own JSON export is the backup mechanism, giving the user full control
  - Settings screen explains this clearly with a "Why isn't my data in iCloud?" FAQ entry

- [ ] **21.4 Storage management**
  - Settings screen: storage usage display (Swift Data store file size + PDF blobs)
  - "Clear all health data" button: deletes all Swift Data records (with double confirmation)
  - Warns user to export a backup before clearing

---

## Milestone 22: Import & Onboarding

> First-run experience; HealthKit permission flow; import from files for users migrating from Phase 1.

- [ ] **22.1 Onboarding flow**
  - Shown on first launch (before dashboard): 3-screen carousel
    1. Value proposition: "All your health data, beautifully visualised"
    2. Privacy: "Your data never leaves your device" — shield icon, bullet points
    3. HealthKit: "Connect your health data" — pre-authorisation explanation, "Get started" button triggers HealthKit permission
  - Skip option for users who have already authorised HealthKit (re-detected via `HKHealthStore.authorizationStatus`)

- [ ] **22.2 Import tab**
  - Mirrors Phase 1 Import page
  - "Connect Apple Health" card: status (Connected / Disconnected), last sync time, "Re-sync" button (triggers incremental HealthKit query)
  - "Import from backup" card: file picker for Phase 1 JSON export or iOS JSON export
  - Import history: list of past imports with date, record count, platform badge

- [ ] **22.3 Apple Health export file import (fallback)**
  - For users who prefer to import manually (or for historical data beyond HealthKit availability)
  - File picker accepting `.zip` files
  - Same `apple-health-parser` logic as Phase 1, rewritten in Swift:
    - Decompress ZIP in-memory using `ZIPFoundation` Swift package
    - Stream-parse `export.xml` using `XMLParser` (iOS built-in SAX parser)
    - Same record type mapping, unit conversion, deduplication as Phase 1
  - Merge with any HealthKit data already present (deduplication by `sourceType + startTime + sourceDevice`)

---

## Milestone 23: Settings & Preferences

> Full parity with Phase 1 settings, plus iOS-specific options.

- [ ] **23.1 Settings screen**
  - `Form`-based layout (iOS-native): grouped sections
  - **Account**: display name (editable), email (read-only), sign out button
  - **Preferences**: unit system (Metric / Imperial), language (System / English / Français), theme (System / Light / Dark)
  - **Health Data**: storage usage, "Re-sync from Apple Health" button, "Clear all data" (destructive)
  - **Export & Backup**: "Export JSON backup", "Export as IPS"
  - **Notifications**: toggle for weekly insight notification
  - **About**: app version, privacy policy link (opens `SafariViewController` to `/privacy`), help link

- [ ] **23.2 Push notifications (weekly insights)**
  - `UNUserNotificationCenter` permission request (on first weekly summary generation)
  - `UNTimeIntervalNotificationTrigger` scheduled weekly on Sunday evening
  - Notification body: "Your weekly health summary is ready" — tapping opens Insights tab
  - No health data in the notification payload

- [ ] **23.3 Widgets (bonus)**
  - `WidgetKit` extension: small widget showing today's steps and resting heart rate
  - Reads from a shared `AppGroup` container: daily summary written by the main app, read by the widget
  - No HealthKit queries in the widget itself (read from the pre-computed shared store)
  - Medium widget: sparkline mini-chart for steps over the past 7 days

---

## Milestone 24: Polish & App Store Readiness

> Production quality: testing, accessibility, localisation, App Store submission.

- [ ] **24.1 Testing**
  - `XCTest` unit tests for all `Core/` services:
    - `AggregationTests`: daily summary computation (same test cases as Phase 1 `aggregate.test.ts`)
    - `NormalizeTests`: HealthKit → `HealthRecord` normalisation (unit conversions, type mapping)
    - `LLMPromptTests`: verify no PII in Standard mode output; verify Enhanced mode gating
    - `IPSBundleTests`: all 5 section LOINC codes present, `FHIRBundle.type == "document"`, `urn:uuid:` fullUrls
    - `SnomedServiceTests`: mock URL session; verify ECL parameters, deduplication, fallback
  - `XCUITest` UI tests for critical flows:
    - Sign up → grant HealthKit → data loads → view dashboard
    - Add condition → appears in Patient Summary preview
    - Ask LLM question → Standard mode → response displayed; toggle Enhanced → warning shown
  - Snapshot tests for key screens (using swift-snapshot-testing)

- [ ] **24.2 Accessibility**
  - All interactive elements have `accessibilityLabel` and `accessibilityHint`
  - Charts include an accessible data table alternative (`accessibilityChartDescriptor` or `List` fallback)
  - Dynamic Type: all text uses system font sizes, layouts reflow at larger sizes
  - VoiceOver: tab order is logical, chart data announced meaningfully
  - Minimum touch target: 44×44 pt for all buttons
  - Reduced Motion: skip chart animations when `UIAccessibility.isReduceMotionEnabled`

- [ ] **24.3 Localisation**
  - String Catalog (`Localizable.xcstrings`) with EN (source) and FR translations
  - All strings use `String(localized:)` — no hardcoded UI text
  - Number formatting: `Measurement` framework + `MeasurementFormatter` for units; `NumberFormatter` for all numeric displays
  - Date formatting: `DateFormatter` / `FormatStyle` with locale — no hardcoded formats
  - i18n completeness check: `xcodebuild -exportLocalizations` in CI — fail if any strings missing in FR

- [ ] **24.4 App Store submission**
  - `Info.plist` privacy usage descriptions for all accessed data (HealthKit, notifications)
  - App Privacy Report: declare no data collected and shared with third parties; data not linked to identity
  - Privacy nutrition label in App Store Connect:
    - Data not collected (health data stays on device)
    - Only data collected: email address (account); app crashes (if crash reporting added)
  - App Store screenshots: 6.5-inch iPhone Pro Max, 12.9-inch iPad Pro (optional)
  - App Review notes: explain HealthKit usage, local-only data storage, LLM proxy (not a health claim)
  - Minimum iOS version: 17.0 (required for Swift Data, `chartOverlay` in Swift Charts, String Catalogs)

---

## Architecture Decisions (Phase 2)

| Decision | Rationale |
|----------|-----------|
| **SwiftUI over UIKit** | Modern declarative UI matches SwiftUI's strengths; `swift-charts` (Swift Charts) is SwiftUI-native; reduces boilerplate vs UIKit |
| **Swift Data over Core Data** | Swift Data is the modern evolution of Core Data on iOS 17+; `@Model` macro reduces schema boilerplate significantly; same persistence engine under the hood |
| **HealthKit observer queries (not polling)** | `HKObserverQuery` + `HKAnchoredObjectQuery` gives real-time updates without polling overhead; background delivery keeps data fresh even when the app is not in the foreground |
| **No HealthKit writes** | Phase 2 is read-only from HealthKit. Manual data (conditions, medications, allergies, lab results) is stored in Swift Data only — not written back to HealthKit (unnecessary complexity, no clear user benefit for this app's purpose) |
| **Swift Charts over third-party** | Native framework, zero dependency overhead, excellent SwiftUI integration, full Dynamic Type and accessibility support out of the box |
| **PDFKit for PDF generation** | Native framework, no dependency, available on iOS 11+. Programmatic PDF context gives full layout control. |
| **Same server, no new backend** | Phase 1 server handles auth + LLM proxy for both web and iOS. The only iOS-specific server consideration is ensuring CORS is not enforced for native app requests (native apps don't use CORS) — `@fastify/cors` is already configured to accept credentialed requests; native apps bypass CORS entirely. |
| **AppGroup for widgets** | Widgets run in a separate process; sharing pre-computed daily summaries via an AppGroup `UserDefaults` or SQLite file avoids duplicating HealthKit queries in the widget extension |
| **JSON export compatible with Phase 1** | Using the same export schema allows users to migrate data between web and iOS, and allows the web app to be used as a backup viewer for iOS data |
| **No iCloud sync (intentional)** | Auto iCloud backup of health data raises privacy concerns (data leaving device via iCloud). The app's own JSON export + AirDrop or Files is the intentional backup mechanism. Cross-device sync (with user-controlled encryption) is a future Phase 4 consideration. |
| **Swift 6 strict concurrency** | All data access via actors eliminates data races; HealthKit and Swift Data access is naturally async — strict concurrency makes this safe without manual locking |
| **ZIPFoundation for Apple Health XML import** | Pure Swift ZIP decompression package; no Objective-C bridge needed; supports streaming decompression for large archives |

---

## Development Order Rationale

Milestones ordered to deliver value incrementally and build on each other:

1. **Foundation** (12) — Xcode project, HealthKit entitlement, Swift Data schema, API client. Nothing works without this.
2. **Auth** (13) — Same server as Phase 1; session management needed before any user-specific data.
3. **HealthKit + Background Sync** (14) — Core differentiator of the iOS app over the web app. Once working, the dashboard has real data immediately.
4. **Dashboard** (15) — Core value; reads from Swift Data which is populated by HealthKit queries.
5. **Trends** (16) — Extends dashboard with deeper analysis; pure client-side computation.
6. **Lab Results** (17) — New data source (PDFs); needed before IPS is fully populated.
7. **Conditions / Medications / Allergies** (18) — Clinical data entry; required for complete IPS.
8. **LLM Insights** (19) — Differentiating AI feature; same privacy model as Phase 1.
9. **IPS Export** (20) — Builds on all clinical data (18) and lab results (17); fully on-device.
10. **Data Portability** (21) — Critical for local-first; enables cross-device migration and web↔iOS compatibility.
11. **Import & Onboarding** (22) — Polish the first-run experience; add fallback XML import for power users.
12. **Settings** (23) — Round out the app; notifications; widgets.
13. **Polish & App Store** (24) — Testing, accessibility, localisation, submission.
