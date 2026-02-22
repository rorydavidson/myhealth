export type MetricCategory =
  | "activity"
  | "heart"
  | "body"
  | "sleep"
  | "vitals"
  | "workouts"
  | "lab_results";

export type MetricType =
  | "step_count"
  | "distance"
  | "active_energy"
  | "flights_climbed"
  | "heart_rate"
  | "resting_heart_rate"
  | "hrv"
  | "body_mass"
  | "body_fat"
  | "sleep_session"
  | "oxygen_saturation"
  | "blood_pressure"
  | "respiratory_rate"
  | "workout";

export type SourcePlatform = "apple_health" | "health_connect";

export interface HealthRecord {
  id: string;
  metricType: MetricType;
  value: number | null;
  unit: string;
  startTime: string; // ISO 8601 UTC
  endTime: string; // ISO 8601 UTC
  sourcePlatform: SourcePlatform;
  sourceDevice: string;
  sourceType: string; // Original type identifier (e.g., HKQuantityTypeIdentifierStepCount)
  importId: string;
  metadata?: Record<string, unknown>;
}

export interface DailySummary {
  id: string; // {metricType}:{date}
  metricType: MetricType;
  date: string; // YYYY-MM-DD
  avg: number | null;
  min: number | null;
  max: number | null;
  sum: number | null;
  count: number;
}

export interface LabResultStructuredValue {
  value: number;
  unit: string;
  flag?: "normal" | "low" | "high" | "critical_low" | "critical_high";
  referenceRange?: string;
  loincCode?: string;
}

export type LabCategory = "blood_panel" | "lipid_panel" | "thyroid" | "metabolic" | "other";

export interface LabResult {
  id: string;
  fileName: string;
  date: string; // YYYY-MM-DD
  category: LabCategory;
  pdfBlob: Blob;
  extractedText: string;
  structuredValues: Record<string, LabResultStructuredValue>;
  notes: string;
  createdAt: string; // ISO 8601
}

export interface Import {
  id: string;
  platform: SourcePlatform;
  fileName: string;
  exportDate: string;
  startedAt: string; // ISO 8601
  completedAt: string | null; // ISO 8601
  recordCount: number;
  status: "processing" | "completed" | "failed";
  dateRange: {
    earliest: string; // ISO 8601
    latest: string; // ISO 8601
  } | null;
}
