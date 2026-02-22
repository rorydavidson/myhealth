/**
 * International Patient Summary (IPS) FHIR Bundle Generator
 *
 * Generates an IPS-compliant FHIR R4 Bundle entirely client-side.
 * The Bundle is a "document" type containing:
 * - Patient resource (name entered at export time, not stored)
 * - Composition resource organizing data into IPS sections
 * - Observation resources for vital signs and lab results
 *
 * All data sourced from local IndexedDB — nothing touches the server.
 */

import type { METRIC_CODING } from "@health-app/shared/coding";
import { db } from "@/db";

// IPS Section LOINC codes
const IPS_SECTIONS = {
  vitalSigns: { code: "8716-3", display: "Vital signs" },
  results: { code: "30954-2", display: "Relevant diagnostic tests/laboratory data" },
  medications: { code: "10160-0", display: "History of Medication use" },
  allergies: { code: "48765-2", display: "Allergies and adverse reactions" },
  problems: { code: "11450-4", display: "Problem list" },
} as const;

// Vital sign metric types that map to IPS Vital Signs section
const VITAL_SIGN_METRICS = [
  "heart_rate",
  "resting_heart_rate",
  "blood_pressure",
  "oxygen_saturation",
  "respiratory_rate",
  "body_mass",
] as const;

export interface IPSExportOptions {
  patientName: string;
  timeRangeDays: number; // e.g., 30, 90, 180, 365
  includeLabResultIds: string[];
}

interface FHIRResource {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

/**
 * Generate a FHIR IPS Bundle from local health data.
 */
export async function generateIPSBundle(options: IPSExportOptions): Promise<FHIRResource> {
  const { patientName, timeRangeDays, includeLabResultIds } = options;

  // Load METRIC_CODING dynamically to avoid circular imports
  const { METRIC_CODING: metricCoding } = await import("@health-app/shared/coding");

  const bundleId = crypto.randomUUID();
  const compositionId = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Build Patient resource
  const patientResource = buildPatientResource(patientId, patientName);

  // Build Vital Signs observations
  const vitalSignObservations = await buildVitalSignObservations(
    patientId,
    timeRangeDays,
    metricCoding,
  );

  // Build Lab Result observations
  const labResultObservations = await buildLabResultObservations(patientId, includeLabResultIds);

  // Build Composition resource
  const composition = buildComposition(
    compositionId,
    patientId,
    now,
    vitalSignObservations,
    labResultObservations,
  );

  // Assemble Bundle
  const entries: FHIRResource[] = [
    composition,
    patientResource,
    ...vitalSignObservations,
    ...labResultObservations,
  ];

  return {
    resourceType: "Bundle",
    id: bundleId,
    type: "document",
    timestamp: now,
    entry: entries.map((resource) => ({
      fullUrl: `urn:uuid:${resource.id}`,
      resource,
    })),
  };
}

function buildPatientResource(patientId: string, name: string): FHIRResource {
  const nameParts = name.trim().split(/\s+/);
  const family = nameParts.length > 1 ? nameParts.slice(-1)[0] : name;
  const given = nameParts.length > 1 ? nameParts.slice(0, -1) : [];

  return {
    resourceType: "Patient",
    id: patientId,
    name: [
      {
        use: "official",
        family,
        given: given.length > 0 ? given : undefined,
        text: name,
      },
    ],
  };
}

async function buildVitalSignObservations(
  patientId: string,
  timeRangeDays: number,
  metricCoding: typeof METRIC_CODING,
): Promise<FHIRResource[]> {
  const observations: FHIRResource[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - timeRangeDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  for (const metricType of VITAL_SIGN_METRICS) {
    const coding = metricCoding[metricType];
    if (!coding?.loinc) continue;

    // Get daily summaries for this metric in the time range
    const summaries = await db.dailySummaries
      .where("[metricType+date]")
      .between([metricType, cutoffStr], [metricType, "9999-99-99"])
      .toArray();

    if (summaries.length === 0) continue;

    // For blood pressure, we need special handling (systolic/diastolic components)
    if (metricType === "blood_pressure") {
      // Get raw records for BP since we need metadata
      const records = await db.healthRecords
        .where("[metricType+startTime]")
        .between([metricType, cutoff], [metricType, new Date("9999-12-31")])
        .toArray();

      if (records.length > 0) {
        // Use the most recent BP record
        const latest = records.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];

        const metadata = latest.metadata as { systolic?: number; diastolic?: number } | undefined;

        if (metadata?.systolic != null && metadata?.diastolic != null) {
          const obsId = crypto.randomUUID();
          observations.push({
            resourceType: "Observation",
            id: obsId,
            status: "final",
            category: [vitalSignCategory()],
            code: {
              coding: buildCodingArray(coding),
              text: coding.loinc.display,
            },
            subject: { reference: `urn:uuid:${patientId}` },
            effectiveDateTime: latest.startTime.toISOString(),
            component: [
              {
                code: {
                  coding: [
                    {
                      system: "http://loinc.org",
                      code: "8480-6",
                      display: "Systolic blood pressure",
                    },
                  ],
                },
                valueQuantity: {
                  value: metadata.systolic,
                  unit: "mmHg",
                  system: "http://unitsofmeasure.org",
                  code: "mm[Hg]",
                },
              },
              {
                code: {
                  coding: [
                    {
                      system: "http://loinc.org",
                      code: "8462-4",
                      display: "Diastolic blood pressure",
                    },
                  ],
                },
                valueQuantity: {
                  value: metadata.diastolic,
                  unit: "mmHg",
                  system: "http://unitsofmeasure.org",
                  code: "mm[Hg]",
                },
              },
            ],
          });
        }
      }
      continue;
    }

    // For other vital signs, use the most recent daily summary
    const latest = summaries.sort((a, b) => b.date.localeCompare(a.date))[0];
    const value = latest.avg ?? latest.sum;
    if (value == null) continue;

    const unit = getUnitForMetric(metricType);
    const obsId = crypto.randomUUID();

    observations.push({
      resourceType: "Observation",
      id: obsId,
      status: "final",
      category: [vitalSignCategory()],
      code: {
        coding: buildCodingArray(coding),
        text: coding.loinc.display,
      },
      subject: { reference: `urn:uuid:${patientId}` },
      effectiveDateTime: `${latest.date}T00:00:00Z`,
      valueQuantity: {
        value: Math.round(value * 100) / 100,
        unit: unit.display,
        system: "http://unitsofmeasure.org",
        code: unit.ucum,
      },
    });
  }

  return observations;
}

async function buildLabResultObservations(
  patientId: string,
  labResultIds: string[],
): Promise<FHIRResource[]> {
  const observations: FHIRResource[] = [];

  if (labResultIds.length === 0) return observations;

  // Load LAB_CODING dynamically
  const { LAB_CODING: labCoding } = await import("@health-app/shared/coding");

  for (const labId of labResultIds) {
    const lab = await db.labResults.get(labId);
    if (!lab?.structuredValues) continue;

    for (const [testName, testData] of Object.entries(lab.structuredValues)) {
      const obsId = crypto.randomUUID();
      const loincCode = testData.loincCode ?? labCoding[testName.toLowerCase()]?.code;
      const loincDisplay = labCoding[testName.toLowerCase()]?.display ?? testName;

      const codeCoding: Array<{ system: string; code: string; display: string }> = [];
      if (loincCode) {
        codeCoding.push({
          system: "http://loinc.org",
          code: loincCode,
          display: loincDisplay,
        });
      }

      const observation: FHIRResource = {
        resourceType: "Observation",
        id: obsId,
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
                display: "Laboratory",
              },
            ],
          },
        ],
        code: {
          coding: codeCoding.length > 0 ? codeCoding : undefined,
          text: testName,
        },
        subject: { reference: `urn:uuid:${patientId}` },
        effectiveDateTime: `${lab.date}T00:00:00Z`,
        valueQuantity: {
          value: testData.value,
          unit: testData.unit,
        },
      };

      // Add reference range if available
      if (testData.referenceRange) {
        (observation as Record<string, unknown>).referenceRange = [
          { text: testData.referenceRange },
        ];
      }

      // Add interpretation if flagged
      if (testData.flag && testData.flag !== "normal") {
        const interpretationCode = getFlagInterpretation(testData.flag);
        if (interpretationCode) {
          (observation as Record<string, unknown>).interpretation = [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                  code: interpretationCode.code,
                  display: interpretationCode.display,
                },
              ],
            },
          ];
        }
      }

      observations.push(observation);
    }
  }

  return observations;
}

function buildComposition(
  compositionId: string,
  patientId: string,
  date: string,
  vitalSignObservations: FHIRResource[],
  labResultObservations: FHIRResource[],
): FHIRResource {
  const sections: Array<{
    title: string;
    code: { coding: Array<{ system: string; code: string; display: string }> };
    entry?: Array<{ reference: string }>;
    emptyReason?: { coding: Array<{ system: string; code: string; display: string }> };
  }> = [];

  // Vital Signs section
  if (vitalSignObservations.length > 0) {
    sections.push({
      title: IPS_SECTIONS.vitalSigns.display,
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: IPS_SECTIONS.vitalSigns.code,
            display: IPS_SECTIONS.vitalSigns.display,
          },
        ],
      },
      entry: vitalSignObservations.map((obs) => ({
        reference: `urn:uuid:${obs.id}`,
      })),
    });
  } else {
    sections.push(emptySection(IPS_SECTIONS.vitalSigns));
  }

  // Results section
  if (labResultObservations.length > 0) {
    sections.push({
      title: IPS_SECTIONS.results.display,
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: IPS_SECTIONS.results.code,
            display: IPS_SECTIONS.results.display,
          },
        ],
      },
      entry: labResultObservations.map((obs) => ({
        reference: `urn:uuid:${obs.id}`,
      })),
    });
  } else {
    sections.push(emptySection(IPS_SECTIONS.results));
  }

  // Required empty sections (app doesn't track these)
  sections.push(emptySection(IPS_SECTIONS.medications));
  sections.push(emptySection(IPS_SECTIONS.allergies));
  sections.push(emptySection(IPS_SECTIONS.problems));

  return {
    resourceType: "Composition",
    id: compositionId,
    status: "final",
    type: {
      coding: [
        {
          system: "http://loinc.org",
          code: "60591-5",
          display: "Patient summary Document",
        },
      ],
    },
    subject: { reference: `urn:uuid:${patientId}` },
    date,
    title: "International Patient Summary",
    section: sections,
  };
}

// --- Helpers ---

function vitalSignCategory() {
  return {
    coding: [
      {
        system: "http://terminology.hl7.org/CodeSystem/observation-category",
        code: "vital-signs",
        display: "Vital Signs",
      },
    ],
  };
}

function buildCodingArray(metricCoding: {
  loinc?: { code: string; display: string; system: string };
  snomed?: { code: string; display: string; system: string };
}) {
  const codingArray: Array<{ system: string; code: string; display: string }> = [];
  if (metricCoding.loinc) {
    codingArray.push({
      system: metricCoding.loinc.system,
      code: metricCoding.loinc.code,
      display: metricCoding.loinc.display,
    });
  }
  if (metricCoding.snomed) {
    codingArray.push({
      system: metricCoding.snomed.system,
      code: metricCoding.snomed.code,
      display: metricCoding.snomed.display,
    });
  }
  return codingArray;
}

function emptySection(section: { code: string; display: string }) {
  return {
    title: section.display,
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: section.code,
          display: section.display,
        },
      ],
    },
    emptyReason: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/list-empty-reason",
          code: "unavailable",
          display: "Unavailable",
        },
      ],
    },
  };
}

function getUnitForMetric(metricType: string): { display: string; ucum: string } {
  const unitMap: Record<string, { display: string; ucum: string }> = {
    heart_rate: { display: "beats/minute", ucum: "/min" },
    resting_heart_rate: { display: "beats/minute", ucum: "/min" },
    oxygen_saturation: { display: "%", ucum: "%" },
    respiratory_rate: { display: "breaths/minute", ucum: "/min" },
    body_mass: { display: "kg", ucum: "kg" },
  };
  return unitMap[metricType] ?? { display: "", ucum: "" };
}

function getFlagInterpretation(flag: string): { code: string; display: string } | null {
  const map: Record<string, { code: string; display: string }> = {
    low: { code: "L", display: "Low" },
    high: { code: "H", display: "High" },
    critical_low: { code: "LL", display: "Critical low" },
    critical_high: { code: "HH", display: "Critical high" },
  };
  return map[flag] ?? null;
}

// --- Export utilities ---

/**
 * Export the IPS Bundle as a JSON file download.
 */
export async function exportIPSAsJson(options: IPSExportOptions): Promise<void> {
  const bundle = await generateIPSBundle(options);
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: "application/fhir+json" });
  const fileName = `ips-${new Date().toISOString().slice(0, 10)}.json`;
  downloadBlob(blob, fileName);
}

/**
 * Export the IPS Bundle as a human-readable PDF.
 */
export async function exportIPSAsPdf(options: IPSExportOptions): Promise<void> {
  const bundle = await generateIPSBundle(options);
  const pdfMake = await import("pdfmake/build/pdfmake");

  // Extract data from bundle for PDF rendering
  const entries = (bundle.entry as Array<{ resource: FHIRResource }>) ?? [];
  const composition = entries.find((e) => e.resource.resourceType === "Composition")?.resource;
  const patient = entries.find((e) => e.resource.resourceType === "Patient")?.resource;
  const observations = entries
    .filter((e) => e.resource.resourceType === "Observation")
    .map((e) => e.resource);

  const patientName =
    (patient?.name as Array<{ text?: string }> | undefined)?.[0]?.text ?? "Unknown";

  const content: Array<Record<string, unknown>> = [];

  // Title
  content.push({
    text: "International Patient Summary",
    style: "header",
    margin: [0, 0, 0, 10],
  });

  // Patient info
  content.push({
    text: `Patient: ${patientName}`,
    style: "subheader",
    margin: [0, 0, 0, 4],
  });
  content.push({
    text: `Generated: ${new Date(bundle.timestamp as string).toLocaleDateString()}`,
    style: "small",
    margin: [0, 0, 0, 16],
  });

  // Sections from composition
  const sections =
    (composition?.section as Array<{
      title: string;
      entry?: Array<{ reference: string }>;
      emptyReason?: unknown;
    }>) ?? [];

  for (const section of sections) {
    content.push({
      text: section.title,
      style: "sectionHeader",
      margin: [0, 12, 0, 6],
    });

    if (section.emptyReason) {
      content.push({
        text: "No information available",
        style: "muted",
        margin: [0, 0, 0, 4],
      });
      continue;
    }

    const sectionObs = (section.entry ?? [])
      .map((entry) => {
        const refId = entry.reference.replace("urn:uuid:", "");
        return observations.find((o) => o.id === refId);
      })
      .filter(Boolean) as FHIRResource[];

    if (sectionObs.length > 0) {
      const tableBody: Array<Array<string | Record<string, unknown>>> = [
        [
          { text: "Test", style: "tableHeader" },
          { text: "Value", style: "tableHeader" },
          { text: "Date", style: "tableHeader" },
        ],
      ];

      for (const obs of sectionObs) {
        const code = obs.code as { text?: string } | undefined;
        const testName = code?.text ?? "—";

        let value = "—";
        const vq = obs.valueQuantity as { value?: number; unit?: string } | undefined;
        if (vq?.value != null) {
          value = `${vq.value} ${vq.unit ?? ""}`.trim();
        }

        // Check for BP components
        const components = obs.component as
          | Array<{
              code?: { coding?: Array<{ display?: string }> };
              valueQuantity?: { value?: number; unit?: string };
            }>
          | undefined;
        if (components?.length) {
          const parts = components
            .map((c) => {
              const cVal = c.valueQuantity;
              return cVal?.value != null ? `${cVal.value}` : "";
            })
            .filter(Boolean);
          if (parts.length > 0) {
            value = `${parts.join("/")} mmHg`;
          }
        }

        const effectiveDate = obs.effectiveDateTime as string | undefined;
        const dateStr = effectiveDate ? new Date(effectiveDate).toLocaleDateString() : "—";

        tableBody.push([testName, value, dateStr]);
      }

      content.push({
        table: {
          headerRows: 1,
          widths: ["*", "auto", "auto"],
          body: tableBody,
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 4],
      });
    }
  }

  // Disclaimer
  content.push({
    text: "This document is generated from self-reported consumer health data. It is not a substitute for professional medical records.",
    style: "disclaimer",
    margin: [0, 20, 0, 0],
  });

  const docDefinition = {
    content,
    styles: {
      header: { fontSize: 18, bold: true },
      subheader: { fontSize: 13, bold: true },
      small: { fontSize: 9, color: "#737373" },
      sectionHeader: { fontSize: 14, bold: true, color: "#3b82f6" },
      muted: { fontSize: 10, italics: true, color: "#a3a3a3" },
      tableHeader: { bold: true, fontSize: 10, color: "#171717" },
      disclaimer: { fontSize: 8, italics: true, color: "#a3a3a3" },
    },
    defaultStyle: {
      fontSize: 10,
    },
  };

  // pdfmake needs vfs for fonts — use the built-in Roboto
  const pdfFonts = await import("pdfmake/build/vfs_fonts");
  const pdfMakeModule = pdfMake as Record<string, unknown>;
  const pdfFontsModule = pdfFonts as Record<string, unknown>;
  pdfMakeModule.vfs =
    pdfFontsModule.vfs ?? (pdfFontsModule.default as Record<string, unknown> | undefined)?.vfs;

  const createPdfFn =
    typeof pdfMakeModule.createPdf === "function"
      ? (pdfMakeModule.createPdf as (def: unknown) => { download: (name: string) => void })
      : ((pdfMakeModule.default as Record<string, unknown>).createPdf as (def: unknown) => {
          download: (name: string) => void;
        });

  const pdf = createPdfFn(docDefinition);
  pdf.download(`ips-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Get a preview of what data will be included in the IPS export.
 */
export async function getIPSPreview(
  timeRangeDays: number,
  labResultIds: string[],
): Promise<{
  vitalSignMetrics: Array<{ metric: string; latestDate: string; latestValue: string }>;
  labResults: Array<{ fileName: string; date: string; testCount: number }>;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - timeRangeDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const vitalSignMetrics: Array<{
    metric: string;
    latestDate: string;
    latestValue: string;
  }> = [];

  for (const metricType of VITAL_SIGN_METRICS) {
    const summaries = await db.dailySummaries
      .where("[metricType+date]")
      .between([metricType, cutoffStr], [metricType, "9999-99-99"])
      .toArray();

    if (summaries.length > 0) {
      const latest = summaries.sort((a, b) => b.date.localeCompare(a.date))[0];
      const value = latest.avg ?? latest.sum;
      const unit = getUnitForMetric(metricType);
      vitalSignMetrics.push({
        metric: metricType,
        latestDate: latest.date,
        latestValue: value != null ? `${Math.round(value * 100) / 100} ${unit.display}` : "—",
      });
    }
  }

  const labResults: Array<{
    fileName: string;
    date: string;
    testCount: number;
  }> = [];

  for (const labId of labResultIds) {
    const lab = await db.labResults.get(labId);
    if (lab) {
      labResults.push({
        fileName: lab.fileName,
        date: lab.date,
        testCount: Object.keys(lab.structuredValues ?? {}).length,
      });
    }
  }

  return { vitalSignMetrics, labResults };
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
