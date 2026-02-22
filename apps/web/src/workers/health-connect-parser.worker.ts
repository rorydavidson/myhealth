/**
 * Google Health Connect JSON Parser Web Worker
 *
 * Parses Health Connect JSON export files.
 * Posts parsed records back to the main thread in batches.
 */

// Message types (reuse the same protocol as apple-health-parser)
export interface HCWorkerMessage {
  type: "start";
  jsonContent: string;
  importId: string;
}

export interface HCWorkerProgress {
  type: "progress";
  phase: "parsing";
  recordsParsed: number;
}

export interface HCWorkerBatch {
  type: "batch";
  records: HCParsedRecord[];
}

export interface HCWorkerComplete {
  type: "complete";
  totalRecords: number;
  exportDate: string | null;
}

export interface HCWorkerError {
  type: "error";
  message: string;
}

export interface HCParsedRecord {
  recordType: string;
  value: number | null;
  unit: string;
  startTime: string;
  endTime: string;
  sourceDevice: string;
  sourceName: string;
  metadata?: Record<string, string>;
}

const BATCH_SIZE = 1000;
const PROGRESS_INTERVAL = 5000;

let records: HCParsedRecord[] = [];
let totalRecords = 0;

function flushBatch() {
  if (records.length > 0) {
    self.postMessage({ type: "batch", records: [...records] } satisfies HCWorkerBatch);
    records = [];
  }
}

function addRecord(record: HCParsedRecord) {
  records.push(record);
  totalRecords++;

  if (records.length >= BATCH_SIZE) {
    flushBatch();
  }

  if (totalRecords % PROGRESS_INTERVAL === 0) {
    self.postMessage({
      type: "progress",
      phase: "parsing",
      recordsParsed: totalRecords,
    } satisfies HCWorkerProgress);
  }
}

/**
 * Parse a Health Connect JSON export.
 * The format varies by exporter, but common formats include:
 * 1. Array of records at top level
 * 2. Object with typed arrays: { StepsRecord: [...], HeartRateRecord: [...] }
 * 3. Object with a "records" or "data" array
 */
function parseExport(json: unknown): void {
  if (Array.isArray(json)) {
    // Format: flat array of records
    for (const item of json) {
      parseRecord(item);
    }
    return;
  }

  if (typeof json !== "object" || json === null) {
    throw new Error("Invalid Health Connect export format");
  }

  const obj = json as Record<string, unknown>;

  // Format: { records: [...] } or { data: [...] }
  if (Array.isArray(obj.records)) {
    for (const item of obj.records) {
      parseRecord(item);
    }
    return;
  }

  if (Array.isArray(obj.data)) {
    for (const item of obj.data) {
      parseRecord(item);
    }
    return;
  }

  // Format: { StepsRecord: [...], HeartRateRecord: [...], ... }
  // Each key is a record type with an array of records
  let foundRecords = false;
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value) && key.endsWith("Record")) {
      foundRecords = true;
      for (const item of value) {
        parseRecordWithType(key, item);
      }
    }
  }

  if (!foundRecords) {
    // Try treating the whole object as a single record
    parseRecord(obj);
  }
}

function parseRecord(item: unknown): void {
  if (typeof item !== "object" || item === null) return;
  const rec = item as Record<string, unknown>;

  // Detect record type from the object
  const recordType =
    (rec.recordType as string) ?? (rec.type as string) ?? (rec.dataType as string) ?? "";

  if (!recordType) return;

  parseRecordWithType(recordType, rec);
}

function parseRecordWithType(recordType: string, rec: unknown): void {
  if (typeof rec !== "object" || rec === null) return;
  const r = rec as Record<string, unknown>;

  const startTime = extractTime(r.startTime ?? r.time ?? r.startZoneOffset ?? r.timestamp);
  const endTime = extractTime(r.endTime ?? r.time ?? r.endZoneOffset ?? r.timestamp) || startTime;

  if (!startTime) return;

  const meta = r.metadata as Record<string, unknown> | undefined;
  const sourceName = extractString(
    meta?.dataOrigin ?? r.dataOrigin ?? r.appId ?? r.packageName ?? "",
  );

  // Handle different record types
  if (recordType === "SleepSessionRecord") {
    parseSleepRecord(r, startTime, endTime, sourceName);
    return;
  }

  if (recordType === "ExerciseSessionRecord") {
    parseExerciseRecord(r, startTime, endTime, sourceName);
    return;
  }

  if (recordType === "BloodPressureRecord") {
    parseBloodPressureRecord(r, startTime, endTime, sourceName);
    return;
  }

  if (recordType === "HeartRateRecord") {
    parseHeartRateRecord(r, startTime, endTime, sourceName);
    return;
  }

  // Standard numeric records
  const { value, unit } = extractValue(r);
  if (value === null) return;

  addRecord({
    recordType,
    value,
    unit,
    startTime,
    endTime,
    sourceDevice: "",
    sourceName,
  });
}

function parseSleepRecord(
  r: Record<string, unknown>,
  startTime: string,
  endTime: string,
  sourceName: string,
): void {
  // Compute total duration in hours
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const hours = (end - start) / (1000 * 60 * 60);

  // Extract stages if available
  const stages = r.stages as Array<Record<string, unknown>> | undefined;
  const metadata: Record<string, string> = {};

  if (Array.isArray(stages)) {
    // Map Health Connect sleep stage constants
    const stageMap: Record<number, string> = {
      0: "awake",
      1: "asleep", // sleeping (unspecified)
      2: "awake", // out of bed
      3: "core", // light
      4: "deep",
      5: "rem",
    };

    for (const stage of stages) {
      const stageType = stage.stage as number;
      const stageName = stageMap[stageType] ?? "asleep";
      metadata.sleepStage = stageName;
    }
  }

  addRecord({
    recordType: "SleepSessionRecord",
    value: hours,
    unit: "hr",
    startTime,
    endTime,
    sourceDevice: "",
    sourceName,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  });
}

function parseExerciseRecord(
  r: Record<string, unknown>,
  startTime: string,
  endTime: string,
  sourceName: string,
): void {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const durationMin = (end - start) / (1000 * 60);

  const exerciseType = (r.exerciseType as number) ?? 0;

  const metadata: Record<string, string> = {
    workoutActivityType: String(exerciseType),
  };

  // Extract distance and calories if available
  if (r.distance != null) {
    const d = r.distance as Record<string, unknown>;
    metadata.totalDistance = String(extractNumber(d.value ?? d.inMeters ?? d));
    metadata.totalDistanceUnit = "meters";
  }

  if (r.activeCalories != null || r.energy != null) {
    const e = (r.activeCalories ?? r.energy) as Record<string, unknown>;
    metadata.totalEnergyBurned = String(extractNumber(e.value ?? e.inKilocalories ?? e));
    metadata.totalEnergyBurnedUnit = "kilocalories";
  }

  addRecord({
    recordType: "ExerciseSessionRecord",
    value: durationMin,
    unit: "min",
    startTime,
    endTime,
    sourceDevice: "",
    sourceName,
    metadata,
  });
}

function parseBloodPressureRecord(
  r: Record<string, unknown>,
  startTime: string,
  endTime: string,
  sourceName: string,
): void {
  const systolic = extractNestedNumber(r.systolic);
  const diastolic = extractNestedNumber(r.diastolic);

  if (systolic !== null) {
    addRecord({
      recordType: "BloodPressureRecord",
      value: systolic,
      unit: "mmHg",
      startTime,
      endTime,
      sourceDevice: "",
      sourceName,
      metadata: { component: "systolic" },
    });
  }

  if (diastolic !== null) {
    addRecord({
      recordType: "BloodPressureRecord",
      value: diastolic,
      unit: "mmHg",
      startTime,
      endTime,
      sourceDevice: "",
      sourceName,
      metadata: { component: "diastolic" },
    });
  }
}

function parseHeartRateRecord(
  r: Record<string, unknown>,
  startTime: string,
  endTime: string,
  sourceName: string,
): void {
  // Heart rate records may have samples array
  const samples = r.samples as Array<Record<string, unknown>> | undefined;

  if (Array.isArray(samples)) {
    for (const sample of samples) {
      const bpm = extractNumber(sample.beatsPerMinute ?? sample.bpm ?? sample.value);
      if (bpm === null) continue;
      const sampleTime = extractTime(sample.time ?? sample.timestamp) || startTime;

      addRecord({
        recordType: "HeartRateRecord",
        value: bpm,
        unit: "bpm",
        startTime: sampleTime,
        endTime: sampleTime,
        sourceDevice: "",
        sourceName,
      });
    }
    return;
  }

  // Single value
  const bpm = extractNumber(r.beatsPerMinute ?? r.bpm ?? r.value);
  if (bpm !== null) {
    addRecord({
      recordType: "HeartRateRecord",
      value: bpm,
      unit: "bpm",
      startTime,
      endTime,
      sourceDevice: "",
      sourceName,
    });
  }
}

// --- Utility functions ---

function extractTime(val: unknown): string {
  if (typeof val === "string") {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }
  if (typeof val === "number") {
    return new Date(val).toISOString();
  }
  return "";
}

function extractString(val: unknown): string {
  if (typeof val === "string") return val;
  if (
    typeof val === "object" &&
    val !== null &&
    "packageName" in (val as Record<string, unknown>)
  ) {
    return (val as Record<string, unknown>).packageName as string;
  }
  return "";
}

function extractNumber(val: unknown): number | null {
  if (typeof val === "number") return Number.isNaN(val) ? null : val;
  if (typeof val === "string") {
    const n = Number.parseFloat(val);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function extractNestedNumber(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") return extractNumber(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    return extractNumber(obj.value ?? obj.inMillimetersOfMercury ?? obj.inMmHg);
  }
  return null;
}

function extractValue(r: Record<string, unknown>): { value: number | null; unit: string } {
  // Try common value field patterns
  // Pattern 1: { value: number, unit: string }
  if (r.value != null) {
    const val = extractNumber(r.value);
    if (val !== null) {
      return { value: val, unit: extractUnit(r) };
    }
  }

  // Pattern 2: { count: number } (for steps, floors)
  if (r.count != null) {
    const val = extractNumber(r.count);
    if (val !== null) return { value: val, unit: "count" };
  }

  // Pattern 3: Nested value objects like { distance: { inMeters: 1234 } }
  for (const key of [
    "distance",
    "energy",
    "mass",
    "weight",
    "percentage",
    "beatsPerMinute",
    "rate",
    "temperature",
  ]) {
    if (r[key] != null) {
      const nested = r[key] as Record<string, unknown>;
      if (typeof nested === "object" && nested !== null) {
        for (const [subKey, subVal] of Object.entries(nested)) {
          const val = extractNumber(subVal);
          if (val !== null) {
            const unit = subKey.replace(/^in/, "").toLowerCase();
            return { value: val, unit: mapNestedUnit(unit) };
          }
        }
      }
      const val = extractNumber(nested);
      if (val !== null) return { value: val, unit: key };
    }
  }

  return { value: null, unit: "" };
}

function extractUnit(r: Record<string, unknown>): string {
  if (typeof r.unit === "string") return r.unit;
  return "";
}

function mapNestedUnit(unit: string): string {
  const map: Record<string, string> = {
    meters: "meters",
    kilometers: "kilometers",
    miles: "miles",
    kilograms: "kilograms",
    pounds: "pounds",
    grams: "grams",
    kilocalories: "kilocalories",
    calories: "calories",
    joules: "joules",
    kilojoules: "kilojoules",
    millimetersofmercury: "mmHg",
    mmhg: "mmHg",
    celsius: "celsius",
    fahrenheit: "fahrenheit",
    beatperminute: "bpm",
    beatsperminute: "bpm",
    milliseconds: "milliseconds",
  };
  return map[unit] ?? unit;
}

// --- Worker entry point ---

self.onmessage = (event: MessageEvent<HCWorkerMessage>) => {
  const { jsonContent } = event.data;
  records = [];
  totalRecords = 0;

  try {
    const parsed = JSON.parse(jsonContent);
    parseExport(parsed);

    // Flush remaining records
    flushBatch();

    self.postMessage({
      type: "complete",
      totalRecords,
      exportDate: null,
    } satisfies HCWorkerComplete);
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : "Unknown parsing error",
    } satisfies HCWorkerError);
  }
};
