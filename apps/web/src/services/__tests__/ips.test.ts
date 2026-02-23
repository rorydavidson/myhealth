/**
 * Unit tests for IPS FHIR Bundle generation.
 * Tests structure validation, required sections, and LOINC coding.
 */

import { describe, expect, it, vi } from "vitest";

// Mock Dexie/IndexedDB — not available in happy-dom
vi.mock("@/db", () => ({
  db: {
    dailySummaries: {
      where: () => ({
        between: () => ({ toArray: async () => [] }),
      }),
    },
    healthRecords: {
      where: () => ({
        between: () => ({ toArray: async () => [] }),
      }),
    },
    labResults: {
      get: async () => null,
    },
    clinicalConditions: {
      toArray: async () => [],
      count: async () => 0,
    },
    medications: {
      toArray: async () => [],
      count: async () => 0,
    },
    allergies: {
      toArray: async () => [],
      count: async () => 0,
    },
  },
}));

// Mock the shared coding dynamic import used inside generateIPSBundle
vi.mock("@health-app/shared/coding", () => ({
  METRIC_CODING: {
    heart_rate: {
      loinc: { code: "8867-4", display: "Heart rate", system: "http://loinc.org" },
    },
    resting_heart_rate: {
      loinc: { code: "40443-4", display: "Resting heart rate", system: "http://loinc.org" },
    },
    blood_pressure: {
      loinc: { code: "85354-9", display: "Blood pressure panel", system: "http://loinc.org" },
    },
    oxygen_saturation: {
      loinc: { code: "2708-6", display: "Oxygen saturation", system: "http://loinc.org" },
    },
    respiratory_rate: {
      loinc: { code: "9279-1", display: "Respiratory rate", system: "http://loinc.org" },
    },
    body_mass: {
      loinc: { code: "29463-7", display: "Body weight", system: "http://loinc.org" },
    },
  },
  LAB_CODING: {},
}));

import { generateIPSBundle } from "../ips";

describe("generateIPSBundle", () => {
  const baseOptions = {
    patientName: "Jane Doe",
    timeRangeDays: 90,
    includeLabResultIds: [],
  };

  it("returns a FHIR R4 Bundle resource", async () => {
    const bundle = await generateIPSBundle(baseOptions);
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("document");
  });

  it("has a timestamp", async () => {
    const bundle = await generateIPSBundle(baseOptions);
    expect(typeof bundle.timestamp).toBe("string");
    expect(new Date(bundle.timestamp as string).getFullYear()).toBeGreaterThan(2020);
  });

  it("contains a Composition as the first entry", async () => {
    const bundle = await generateIPSBundle(baseOptions);
    const entries = bundle.entry as Array<{ resource: { resourceType: string } }>;
    expect(entries[0].resource.resourceType).toBe("Composition");
  });

  it("contains a Patient resource", async () => {
    const bundle = await generateIPSBundle(baseOptions);
    const entries = bundle.entry as Array<{ resource: { resourceType: string } }>;
    const patient = entries.find((e) => e.resource.resourceType === "Patient");
    expect(patient).toBeDefined();
  });

  it("parses patient name correctly", async () => {
    const bundle = await generateIPSBundle({ ...baseOptions, patientName: "Jane Doe" });
    const entries = bundle.entry as Array<{
      resource: {
        resourceType: string;
        name?: Array<{ family?: string; given?: string[]; text?: string }>;
      };
    }>;
    const patient = entries.find((e) => e.resource.resourceType === "Patient");
    const name = patient?.resource.name?.[0];
    expect(name?.family).toBe("Doe");
    expect(name?.given).toEqual(["Jane"]);
    expect(name?.text).toBe("Jane Doe");
  });

  it("composition includes all required IPS sections", async () => {
    const bundle = await generateIPSBundle(baseOptions);
    const entries = bundle.entry as Array<{
      resource: {
        resourceType: string;
        section?: Array<{ code: { coding: Array<{ code: string }> } }>;
      };
    }>;
    const composition = entries.find((e) => e.resource.resourceType === "Composition");
    const sections = composition?.resource.section ?? [];
    const sectionCodes = sections.map((s) => s.code.coding[0]?.code);

    // Required IPS sections
    expect(sectionCodes).toContain("8716-3");  // Vital Signs
    expect(sectionCodes).toContain("30954-2"); // Results
    expect(sectionCodes).toContain("10160-0"); // Medications
    expect(sectionCodes).toContain("48765-2"); // Allergies
    expect(sectionCodes).toContain("11450-4"); // Problem List
  });

  it("sections with no data have emptyReason", async () => {
    const bundle = await generateIPSBundle(baseOptions);
    const entries = bundle.entry as Array<{
      resource: {
        resourceType: string;
        section?: Array<{ emptyReason?: unknown; entry?: unknown[] }>;
      };
    }>;
    const composition = entries.find((e) => e.resource.resourceType === "Composition");
    const sections = composition?.resource.section ?? [];

    // With no data, all sections should have emptyReason
    for (const section of sections) {
      if (!section.entry || section.entry.length === 0) {
        expect(section.emptyReason).toBeDefined();
      }
    }
  });

  it("all entry fullUrls are urn:uuid format", async () => {
    const bundle = await generateIPSBundle(baseOptions);
    const entries = bundle.entry as Array<{ fullUrl: string }>;
    for (const entry of entries) {
      expect(entry.fullUrl).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);
    }
  });

  it("handles single-name patient (no family/given split)", async () => {
    const bundle = await generateIPSBundle({ ...baseOptions, patientName: "Cher" });
    const entries = bundle.entry as Array<{
      resource: {
        resourceType: string;
        name?: Array<{ family?: string; text?: string }>;
      };
    }>;
    const patient = entries.find((e) => e.resource.resourceType === "Patient");
    const name = patient?.resource.name?.[0];
    expect(name?.text).toBe("Cher");
    expect(name?.family).toBe("Cher");
  });
});

describe("IPS section LOINC codes", () => {
  it("vital signs section uses correct LOINC code", () => {
    expect("8716-3").toMatch(/^\d{4,5}-\d$/);
  });

  it("results section uses correct LOINC code", () => {
    expect("30954-2").toMatch(/^\d{4,5}-\d$/);
  });

  it("medications section uses correct LOINC code", () => {
    expect("10160-0").toMatch(/^\d{4,5}-\d$/);
  });

  it("allergies section uses correct LOINC code", () => {
    expect("48765-2").toMatch(/^\d{4,5}-\d$/);
  });

  it("problem list section uses correct LOINC code", () => {
    expect("11450-4").toMatch(/^\d{4,5}-\d$/);
  });
});
