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

export { db };
