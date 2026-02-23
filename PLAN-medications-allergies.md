# Plan: Medications and Allergies Pages

## Overview

Two new pages — **History of Medication Use** and **Allergies & Adverse Reactions** — modelled exactly on the Conditions page. Both use SNOMED CT for coded entries, store data locally in IndexedDB, and populate the currently-empty IPS sections in the Patient Summary export.

---

## 1. SNOMED CT Hierarchies

The existing `searchSnomedConditions` function searches only under `< 404684003 |Clinical finding|`. Medications and allergies require different SNOMED hierarchies — and allergies can reference substances or findings, depending on the intolerance type.

### Medications
SNOMED CT hierarchy: **`< 373873005 |Pharmaceutical / biologic product|`**

This covers all drugs, biologics, and pharmaceutical products. Examples: Metformin, Lisinopril, Atorvastatin, Amoxicillin.

Alternative: Some servers support the `< 105590001 |Substance|` hierarchy, which is broader and includes non-pharmaceutical substances. The pharmaceutical hierarchy is preferable for medications.

### Allergies / Adverse Reactions
SNOMED CT has two relevant hierarchies:

1. **`< 105590001 |Substance|`** — the allergen/substance that causes the reaction (e.g., Penicillin, Peanut, Latex, Ibuprofen). This is the primary hierarchy for allergens.
2. **`< 418038007 |Propensity to adverse reactions to substance|`** — for pre-coded allergy findings (less commonly used for search).

**Recommended**: Search `< 105590001 |Substance|` for allergen lookup. This covers foods, drugs, environmental allergens, and biological substances.

### New search functions in `snomed.ts`

Add two new exported search functions alongside `searchSnomedConditions`:

```typescript
const MEDICATION_ECL = "< 373873005 |Pharmaceutical / biologic product|";
const SUBSTANCE_ECL = "< 105590001 |Substance|";

export async function searchSnomedMedications(query: string, count = 15): Promise<SnomedSearchResult>
export async function searchSnomedSubstances(query: string, count = 15): Promise<SnomedSearchResult>
```

Both follow the same pattern as `searchSnomedConditions` — ECL-constrained primary search with an unconstrained fallback. The internal `fhirExpandValueSet` helper is reused unchanged.

---

## 2. Database Schema

### New tables (DB version 5)

#### `medications` table

```typescript
export interface MedicationRow {
  id: string;                              // UUID
  snomedCode: string;                      // SNOMED CT code for the product
  snomedDisplay: string;                   // Preferred term
  dose?: string;                           // Free text, e.g. "10mg once daily"
  startDate?: string;                      // YYYY-MM-DD
  endDate?: string;                        // YYYY-MM-DD, null = ongoing
  status: "active" | "stopped" | "on-hold";
  reason?: string;                         // Free text, e.g. "type 2 diabetes"
  notes?: string;
  createdAt: Date;
}
```

Dexie index: `"id, snomedCode, status, createdAt"`

#### `allergies` table

```typescript
export interface AllergyRow {
  id: string;                              // UUID
  snomedCode: string;                      // SNOMED CT code for the substance/allergen
  snomedDisplay: string;                   // Preferred term
  type: "allergy" | "intolerance";         // FHIR AllergyIntolerance.type
  category: "food" | "medication" | "environment" | "biologic";
  criticality: "low" | "high" | "unable-to-assess";
  reaction?: string;                       // Free text, e.g. "hives, anaphylaxis"
  onsetDate?: string;                      // YYYY-MM-DD
  notes?: string;
  createdAt: Date;
}
```

Dexie index: `"id, snomedCode, category, createdAt"`

### DB version increment

```typescript
// db/index.ts — add version 5
db.version(5).stores({
  healthRecords: "id, [metricType+startTime], sourcePlatform, importId",
  dailySummaries: "id, [metricType+date]",
  labResults: "id, date, category",
  clinicalConditions: "id, snomedCode, status, createdAt",
  medications: "id, snomedCode, status, createdAt",
  allergies: "id, snomedCode, category, createdAt",
  imports: "id, startedAt",
});
```

Export new interfaces and add `medications` and `allergies` to the typed `db` object.

---

## 3. Route Files

### `apps/web/src/routes/_app/medications.tsx`

Structure mirrors `conditions.tsx` exactly:

- `MedicationsPage` — lists all medications with a `useLiveQuery`, shows an "Add medication" button
- `AddMedicationForm` — SNOMED CT search (using `searchSnomedMedications`), plus fields:
  - **Dose** — free-text input, e.g. "10mg once daily" (optional)
  - **Start date** — date picker (optional)
  - **End date** — date picker (optional, leave blank = ongoing)
  - **Status** — select: Active / Stopped / On hold
  - **Reason** — free-text, e.g. "prescribed for hypertension" (optional)
  - **Notes** — textarea (optional)
- `MedicationCard` — displays one medication entry with delete confirmation

Status badge colours:
- `active` → emerald (same as conditions)
- `stopped` → neutral/grey
- `on-hold` → amber

### `apps/web/src/routes/_app/allergies.tsx`

Structure mirrors `conditions.tsx`:

- `AllergiesPage` — lists all allergies, "Add allergy" button
- `AddAllergyForm` — SNOMED CT search (using `searchSnomedSubstances`), plus fields:
  - **Type** — select: Allergy / Intolerance
  - **Category** — select: Food / Medication / Environment / Biologic
  - **Criticality** — select: Low / High / Unable to assess
  - **Reaction** — free-text, e.g. "hives, swelling" (optional)
  - **Onset date** — date picker (optional)
  - **Notes** — textarea (optional)
- `AllergyCard` — displays one allergy entry

Criticality badge colours:
- `high` → rose
- `low` → amber
- `unable-to-assess` → neutral/grey

---

## 4. Sidebar Navigation

Add two new items to `navItems` in `sidebar.tsx`, between Conditions and Insights:

```typescript
{
  labelKey: "nav.medications",
  to: "/medications",
  icon: Pill,           // lucide-react
  color: "text-sky-500",
},
{
  labelKey: "nav.allergies",
  to: "/allergies",
  icon: ShieldAlert,    // lucide-react
  color: "text-rose-500",
},
```

---

## 5. i18n Files

### New namespace files

Create `apps/web/src/locales/en/medications.json` and `apps/web/src/locales/fr/medications.json`.
Create `apps/web/src/locales/en/allergies.json` and `apps/web/src/locales/fr/allergies.json`.

Both follow the same key structure as `conditions.json`:
- `title`, `description`, `descriptionDetail`, `privacy`
- `addX`, `yourX`, `noX`, `fhirServer`
- `status.*` (or `criticality.*` for allergies)
- `card.*`
- `form.*`

### `common.json` additions

```json
"nav": {
  "medications": "Medications",
  "allergies": "Allergies"
}
```

Update `fr/common.json` accordingly:
```json
"nav": {
  "medications": "Médicaments",
  "allergies": "Allergies"
}
```

### i18n registration

Register the two new namespaces in `apps/web/src/lib/i18n.ts` alongside the existing ones.

---

## 6. IPS Export Integration (`services/ips.ts`)

The IPS `buildComposition` currently hardcodes `emptySection` for both medications and allergies. Replace those with populated sections when data exists.

### New builder functions

```typescript
async function buildMedicationStatementResources(patientId: string): Promise<FHIRResource[]>
async function buildAllergyIntoleranceResources(patientId: string): Promise<FHIRResource[]>
```

#### `buildMedicationStatementResources`
- Reads `db.medications.toArray()`
- Returns a FHIR `MedicationStatement` resource per entry:
  - `resourceType: "MedicationStatement"`
  - `status`: maps `active` → `"active"`, `stopped` → `"stopped"`, `on-hold` → `"on-hold"`
  - `medicationCodeableConcept.coding`: SNOMED CT system + code + display
  - `subject`: reference to Patient
  - `dosage[0].text`: the free-text dose field
  - `note[0].text`: the notes field

#### `buildAllergyIntoleranceResources`
- Reads `db.allergies.toArray()`
- Returns a FHIR `AllergyIntolerance` resource per entry:
  - `resourceType: "AllergyIntolerance"`
  - `type`: `"allergy"` or `"intolerance"`
  - `category`: `["food"]` / `["medication"]` / `["environment"]` / `["biologic"]`
  - `criticality`: `"low"` / `"high"` / `"unable-to-assess"`
  - `code.coding`: SNOMED CT system + code + display
  - `patient`: reference to Patient
  - `reaction[0].description`: the free-text reaction field if provided

### `generateIPSBundle` signature update

Pass the two new resource arrays through `buildComposition` and into the bundle entries:

```typescript
const medicationResources = await buildMedicationStatementResources(patientId);
const allergyResources = await buildAllergyIntoleranceResources(patientId);

const composition = buildComposition(
  compositionId, patientId, now,
  vitalSignObservations, labResultObservations,
  conditionResources, medicationResources, allergyResources,
);

const entries = [
  composition, patientResource,
  ...vitalSignObservations, ...labResultObservations,
  ...conditionResources, ...medicationResources, ...allergyResources,
];
```

### `buildComposition` update

Replace the two `emptySection` calls with conditional logic matching the Conditions pattern:

```typescript
if (medicationResources.length > 0) {
  sections.push({ title, code, entry: medicationResources.map(ref) });
} else {
  sections.push(emptySection(IPS_SECTIONS.medications));
}

if (allergyResources.length > 0) {
  sections.push({ title, code, entry: allergyResources.map(ref) });
} else {
  sections.push(emptySection(IPS_SECTIONS.allergies));
}
```

### PDF export update (`exportIPSAsPdf`)

Extend the section rendering loop to handle `MedicationStatement` and `AllergyIntolerance` resource types in addition to `Observation` and `Condition`. These sections render their own table layouts:

- **Medications table**: Medication | Dose | Status | Start date
- **Allergies table**: Substance | Type | Criticality | Reaction

---

## 7. Patient Summary Preview Update (`getIPSPreview`)

Add medication and allergy counts to the preview returned by `getIPSPreview`:

```typescript
return {
  vitalSignMetrics,
  labResults,
  conditionCount,
  medicationCount,   // number
  allergyCount,      // number
};
```

Update `patient-summary.tsx` to display these counts in the preview card, matching the existing `conditionCount` pattern.

---

## 8. Data Export (`services/export.ts`)

The existing `exportDataAsJson` and `importDataFromJson` functions enumerate all Dexie tables. Check whether they use `db.tables` (automatic) or enumerate tables manually — if manual, add `medications` and `allergies` to the export/import list.

---

## 9. Route Tree

TanStack Router auto-generates `routeTree.gen.ts` from the file system. Adding the two new route files will cause it to regenerate automatically on the next `pnpm dev` run — no manual changes needed.

---

## Implementation Order

1. **`db/index.ts`** — add interfaces and version 5 schema
2. **`services/snomed.ts`** — add `searchSnomedMedications` and `searchSnomedSubstances`
3. **`lib/i18n.ts`** — register new namespaces
4. **i18n JSON files** — create en/fr for medications and allergies
5. **`common.json`** — add nav keys (both locales)
6. **`routes/_app/medications.tsx`** — build the page
7. **`routes/_app/allergies.tsx`** — build the page
8. **`sidebar.tsx`** — add nav items
9. **`services/ips.ts`** — wire up the new sections
10. **`routes/_app/patient-summary.tsx`** — update preview counts

Each step is independently testable; steps 1–5 are non-UI groundwork, steps 6–8 are the visible pages, and steps 9–10 close the IPS loop.
