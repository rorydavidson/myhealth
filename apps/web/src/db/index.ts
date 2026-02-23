import Dexie, { type EntityTable } from "dexie";

export interface HealthRecordRow {
  id: string;
  metricType: string;
  value: number | null;
  unit: string;
  startTime: Date;
  endTime: Date;
  sourcePlatform: string;
  sourceDevice: string;
  sourceType: string;
  importId: string;
  metadata?: Record<string, unknown>;
}

export interface DailySummaryRow {
  id: string; // {metricType}:{date}
  metricType: string;
  date: string; // YYYY-MM-DD
  avg: number | null;
  min: number | null;
  max: number | null;
  sum: number | null;
  count: number;
}

export interface LabResultRow {
  id: string;
  fileName: string;
  date: string; // YYYY-MM-DD
  category: string;
  pdfBlob: Blob;
  extractedText: string;
  structuredValues: Record<
    string,
    {
      value: number;
      unit: string;
      flag?: string;
      referenceRange?: string;
      loincCode?: string;
    }
  >;
  notes: string;
  createdAt: Date;
}

export interface ClinicalConditionRow {
  id: string;
  description: string; // User-entered description, e.g. "Type 2 Diabetes"
  snomedCode: string; // e.g. "44054006"
  snomedDisplay: string; // e.g. "Diabetes mellitus type 2"
  onsetDate?: string; // YYYY-MM-DD, optional
  status: "active" | "resolved" | "inactive";
  notes?: string;
  createdAt: Date;
  /** AI-generated plain-text summary of the condition, generated once on add and cached here. */
  aiSummary?: string;
}

export interface MedicationRow {
  id: string;
  snomedCode: string; // SNOMED CT code for the pharmaceutical product
  snomedDisplay: string; // Preferred term, e.g. "Metformin"
  dose?: string; // Free text, e.g. "500mg twice daily"
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD, absent = ongoing
  status: "active" | "stopped" | "on-hold";
  reason?: string; // Free text, e.g. "type 2 diabetes"
  notes?: string;
  createdAt: Date;
}

export interface AllergyRow {
  id: string;
  snomedCode: string; // SNOMED CT code for the allergen substance
  snomedDisplay: string; // Preferred term, e.g. "Penicillin"
  type: "allergy" | "intolerance";
  category: "food" | "medication" | "environment" | "biologic";
  criticality: "low" | "high" | "unable-to-assess";
  reaction?: string; // Free text, e.g. "hives, anaphylaxis"
  onsetDate?: string; // YYYY-MM-DD
  notes?: string;
  createdAt: Date;
  /** AI-generated plain-text summary of the allergen/condition, generated once on add and cached here. */
  aiSummary?: string;
}

export interface ImportRow {
  id: string;
  platform: string;
  fileName: string;
  exportDate: string;
  startedAt: Date;
  completedAt: Date | null;
  recordCount: number;
  status: string;
  progressPct?: number; // 0-100, used during processing to show live progress
  dateRange: { earliest: Date; latest: Date } | null;
}

const db = new Dexie("HealthDashboard") as Dexie & {
  healthRecords: EntityTable<HealthRecordRow, "id">;
  dailySummaries: EntityTable<DailySummaryRow, "id">;
  labResults: EntityTable<LabResultRow, "id">;
  clinicalConditions: EntityTable<ClinicalConditionRow, "id">;
  medications: EntityTable<MedicationRow, "id">;
  allergies: EntityTable<AllergyRow, "id">;
  imports: EntityTable<ImportRow, "id">;
};

db.version(1).stores({
  healthRecords: "id, [metricType+startTime], sourcePlatform, importId",
  dailySummaries: "id, [metricType+date]",
  labResults: "id, date, category",
  imports: "id",
});

db.version(2).stores({
  healthRecords: "id, [metricType+startTime], sourcePlatform, importId",
  dailySummaries: "id, [metricType+date]",
  labResults: "id, date, category",
  imports: "id, startedAt",
});

db.version(3).stores({
  healthRecords: "id, [metricType+startTime], sourcePlatform, importId",
  dailySummaries: "id, [metricType+date]",
  labResults: "id, date, category",
  clinicalConditions: "id, snomedCode, status",
  imports: "id, startedAt",
});

db.version(4).stores({
  healthRecords: "id, [metricType+startTime], sourcePlatform, importId",
  dailySummaries: "id, [metricType+date]",
  labResults: "id, date, category",
  clinicalConditions: "id, snomedCode, status, createdAt",
  imports: "id, startedAt",
});

db.version(5).stores({
  healthRecords: "id, [metricType+startTime], sourcePlatform, importId",
  dailySummaries: "id, [metricType+date]",
  labResults: "id, date, category",
  clinicalConditions: "id, snomedCode, status, createdAt",
  medications: "id, snomedCode, status, createdAt",
  allergies: "id, snomedCode, category, createdAt",
  imports: "id, startedAt",
});

// Version 6: add aiSummary field to clinicalConditions and allergies (optional field, no index change needed)
db.version(6).stores({
  healthRecords: "id, [metricType+startTime], sourcePlatform, importId",
  dailySummaries: "id, [metricType+date]",
  labResults: "id, date, category",
  clinicalConditions: "id, snomedCode, status, createdAt",
  medications: "id, snomedCode, status, createdAt",
  allergies: "id, snomedCode, category, createdAt",
  imports: "id, startedAt",
});

export { db };
