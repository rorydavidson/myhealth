/**
 * SNOMED CT Terminology Service
 *
 * Uses the FHIR Terminology Services API (R4) to search for SNOMED CT clinical concepts.
 * The FHIR base URL is configurable via VITE_FHIR_TERMINOLOGY_URL environment variable.
 *
 * Default: https://r4.ontoserver.csiro.au/fhir (CSIRO Ontoserver — reliable public FHIR server)
 *
 * Endpoints used:
 * - ValueSet/$expand — search for concepts matching a user query
 * - CodeSystem/$lookup — retrieve details for a specific SNOMED CT code
 */

const FHIR_BASE_URL =
  import.meta.env.VITE_FHIR_TERMINOLOGY_URL ?? "https://r4.ontoserver.csiro.au/fhir";

const SNOMED_SYSTEM = "http://snomed.info/sct";
const SNOMED_SYNONYM_CODE = "900000000000013009";

// Only search for clinical findings (disorders, diseases, symptoms)
// SNOMED CT "Clinical finding" hierarchy: 404684003
const CLINICAL_FINDING_ECL = "< 404684003 |Clinical finding|";

// Pharmaceutical / biologic products — for medication search
const MEDICATION_ECL = "< 373873005 |Pharmaceutical / biologic product|";

// Substances — covers food, drug, environmental, biologic allergens
const SUBSTANCE_ECL = "< 105590001 |Substance|";

// Allergic/adverse reaction disorders — covers named conditions like "Hay fever",
// "Penicillin allergy", "Peanut allergy" (subtype of Clinical finding)
// 473010000 = Hypersensitivity condition
const ALLERGY_DISORDER_ECL = "< 473010000 |Hypersensitivity condition|";

export interface SnomedConcept {
  code: string;
  display: string; // Preferred term
  system: string;
  matchedSynonym?: string; // Set when the user's query matched a synonym, not the preferred term
}

export interface SnomedSearchResult {
  concepts: SnomedConcept[];
  total: number;
}

/**
 * Search SNOMED CT for clinical conditions matching a text filter.
 * Uses FHIR ValueSet/$expand with the ECL-constrained implicit ValueSet URL,
 * falling back to the unconstrained SNOMED CT ValueSet if the server doesn't support ECL.
 */
export async function searchSnomedConditions(
  query: string,
  count = 15,
): Promise<SnomedSearchResult> {
  if (!query.trim() || query.trim().length < 2) {
    return { concepts: [], total: 0 };
  }

  // Primary: ECL-constrained search — limits results to clinical findings only
  const eclParams = new URLSearchParams({
    url: `${SNOMED_SYSTEM}?fhir_vs=ecl/${encodeURIComponent(CLINICAL_FINDING_ECL)}`,
    filter: query.trim(),
    count: String(count),
    includeDesignations: "true",
  });

  try {
    const result = await fhirExpandValueSet(eclParams, query.trim());
    if (result && result.concepts.length > 0) return result;
  } catch {
    // Fall through to simpler search
  }

  // Fallback: expand all of SNOMED CT with a text filter (no ECL constraint)
  const fallbackParams = new URLSearchParams({
    url: `${SNOMED_SYSTEM}?fhir_vs`,
    filter: query.trim(),
    count: String(count),
    includeDesignations: "true",
  });

  try {
    const result = await fhirExpandValueSet(fallbackParams, query.trim());
    if (result) return result;
  } catch {
    // Final fallback failed
  }

  return { concepts: [], total: 0 };
}

/**
 * Search SNOMED CT for pharmaceutical/biologic products matching a text filter.
 * Used for medication lookup.
 */
export async function searchSnomedMedications(
  query: string,
  count = 15,
): Promise<SnomedSearchResult> {
  if (!query.trim() || query.trim().length < 2) {
    return { concepts: [], total: 0 };
  }

  const eclParams = new URLSearchParams({
    url: `${SNOMED_SYSTEM}?fhir_vs=ecl/${encodeURIComponent(MEDICATION_ECL)}`,
    filter: query.trim(),
    count: String(count),
    includeDesignations: "true",
  });

  try {
    const result = await fhirExpandValueSet(eclParams, query.trim());
    if (result && result.concepts.length > 0) return result;
  } catch {
    // Fall through to simpler search
  }

  const fallbackParams = new URLSearchParams({
    url: `${SNOMED_SYSTEM}?fhir_vs`,
    filter: query.trim(),
    count: String(count),
    includeDesignations: "true",
  });

  try {
    const result = await fhirExpandValueSet(fallbackParams, query.trim());
    if (result) return result;
  } catch {
    // Final fallback failed
  }

  return { concepts: [], total: 0 };
}

/**
 * Search SNOMED CT for allergens and allergic conditions matching a text filter.
 * Used for allergy/adverse reaction lookup.
 *
 * Searches two hierarchies in parallel and merges results:
 *   1. Substance hierarchy — individual allergens (Pollen, Penicillin, Peanut)
 *   2. Hypersensitivity condition hierarchy — named allergic disorders (Hay fever,
 *      Penicillin allergy, Peanut allergy)
 *
 * Both are valid for FHIR AllergyIntolerance.code per the IPS specification.
 */
export async function searchSnomedSubstances(
  query: string,
  count = 15,
): Promise<SnomedSearchResult> {
  if (!query.trim() || query.trim().length < 2) {
    return { concepts: [], total: 0 };
  }

  const trimmed = query.trim();
  const perHierarchyCount = count;

  // Search both hierarchies concurrently
  const [substanceResult, disorderResult] = await Promise.allSettled([
    fhirExpandValueSet(
      new URLSearchParams({
        url: `${SNOMED_SYSTEM}?fhir_vs=ecl/${encodeURIComponent(SUBSTANCE_ECL)}`,
        filter: trimmed,
        count: String(perHierarchyCount),
        includeDesignations: "true",
      }),
      trimmed,
    ),
    fhirExpandValueSet(
      new URLSearchParams({
        url: `${SNOMED_SYSTEM}?fhir_vs=ecl/${encodeURIComponent(ALLERGY_DISORDER_ECL)}`,
        filter: trimmed,
        count: String(perHierarchyCount),
        includeDesignations: "true",
      }),
      trimmed,
    ),
  ]);

  const seen = new Set<string>();
  const merged: SnomedConcept[] = [];

  for (const settled of [substanceResult, disorderResult]) {
    if (settled.status === "fulfilled" && settled.value?.concepts) {
      for (const concept of settled.value.concepts) {
        if (!seen.has(concept.code)) {
          seen.add(concept.code);
          merged.push(concept);
        }
      }
    }
  }

  if (merged.length > 0) {
    return { concepts: merged.slice(0, count), total: merged.length };
  }

  // Fallback: unconstrained SNOMED CT search
  try {
    const result = await fhirExpandValueSet(
      new URLSearchParams({
        url: `${SNOMED_SYSTEM}?fhir_vs`,
        filter: trimmed,
        count: String(count),
        includeDesignations: "true",
      }),
      trimmed,
    );
    if (result) return result;
  } catch {
    // Final fallback failed
  }

  return { concepts: [], total: 0 };
}

/**
 * Look up a specific SNOMED CT code to get its preferred display term.
 */
export async function lookupSnomedCode(code: string): Promise<SnomedConcept | null> {
  const params = new URLSearchParams({
    system: SNOMED_SYSTEM,
    code,
  });

  try {
    const res = await fetch(`${FHIR_BASE_URL}/CodeSystem/$lookup?${params.toString()}`, {
      headers: { Accept: "application/fhir+json" },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const displayParam = data.parameter?.find(
      (p: { name: string; valueString?: string }) => p.name === "display",
    );

    if (displayParam?.valueString) {
      return {
        code,
        display: displayParam.valueString,
        system: SNOMED_SYSTEM,
      };
    }
  } catch {
    // Network error — return null
  }

  return null;
}

/**
 * Get the configured FHIR Terminology Server URL (for display in settings).
 */
export function getFhirTerminologyUrl(): string {
  return FHIR_BASE_URL;
}

// --- Internal helpers ---

interface FhirDesignation {
  language?: string;
  use?: { system?: string; code?: string; display?: string };
  value?: string;
}

interface FhirConcept {
  system?: string;
  code?: string;
  display?: string;
  designation?: FhirDesignation[];
}

async function fhirExpandValueSet(
  params: URLSearchParams,
  query: string,
): Promise<SnomedSearchResult | null> {
  const res = await fetch(`${FHIR_BASE_URL}/ValueSet/$expand?${params.toString()}`, {
    headers: { Accept: "application/fhir+json" },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const expansion = data.expansion;

  if (!expansion?.contains) {
    return { concepts: [], total: expansion?.total ?? 0 };
  }

  const queryLower = query.toLowerCase();

  const concepts: SnomedConcept[] = (expansion.contains as FhirConcept[])
    .filter((c): c is FhirConcept & { code: string; display: string } =>
      Boolean(c.code && c.display),
    )
    .map((c) => {
      const concept: SnomedConcept = {
        code: c.code,
        display: c.display,
        system: c.system ?? SNOMED_SYSTEM,
      };

      // If the preferred term doesn't contain the query, find the synonym that does
      if (!c.display.toLowerCase().includes(queryLower) && c.designation) {
        const matched = c.designation.find(
          (d) =>
            d.use?.code === SNOMED_SYNONYM_CODE &&
            d.value?.toLowerCase().includes(queryLower),
        );
        if (matched?.value) {
          concept.matchedSynonym = matched.value;
        }
      }

      return concept;
    });

  return {
    concepts,
    total: expansion.total ?? concepts.length,
  };
}
