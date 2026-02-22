/**
 * Apple Health XML Parser Web Worker
 *
 * Streams a large Apple Health export.xml using SAX parser.
 * Accepts XML in chunks via "chunk" messages for memory-efficient streaming.
 * Posts parsed records back to the main thread in batches.
 * Never loads the entire XML into memory.
 */
import { parser as createSaxParser, type SAXParser } from "sax";

// Message types — the worker accepts three message types:
// "start" - initialize the parser (with optional cutoff date for filtering)
// "chunk" - feed a chunk of XML text to the parser
// "end"   - signal that all chunks have been sent

export type WorkerMessage =
  | { type: "start"; importId: string; cutoffDate?: string }
  | { type: "chunk"; xmlChunk: string }
  | { type: "end" };

export interface WorkerProgress {
  type: "progress";
  phase: "parsing";
  recordsParsed: number;
  bytesProcessed: number;
  totalBytes: number;
}

export interface WorkerBatch {
  type: "batch";
  records: ParsedRecord[];
}

export interface WorkerComplete {
  type: "complete";
  totalRecords: number;
  exportDate: string | null;
}

export interface WorkerError {
  type: "error";
  message: string;
}

export interface ParsedRecord {
  type: string; // HK type identifier
  value: number | null;
  unit: string;
  startDate: string;
  endDate: string;
  sourceDevice: string;
  sourceName: string;
  metadata?: Record<string, string>;
}

export interface ParsedWorkout {
  type: string;
  workoutActivityType: string;
  duration: number;
  durationUnit: string;
  totalDistance: number | null;
  totalDistanceUnit: string;
  totalEnergyBurned: number | null;
  totalEnergyBurnedUnit: string;
  startDate: string;
  endDate: string;
  sourceDevice: string;
  sourceName: string;
}

const BATCH_SIZE = 1000;
const PROGRESS_INTERVAL = 5000; // Report progress every 5000 records

let saxParser: SAXParser;
let records: ParsedRecord[] = [];
let totalRecords = 0;
let exportDate: string | null = null;
let cutoffTimestamp: number | null = null; // Unix ms — records before this are skipped

// Track current element context for nested data
let insideCorrelation = false;
let correlationType = "";
let correlationRecords: ParsedRecord[] = [];

/**
 * Returns true if the record's date is before the cutoff and should be skipped.
 * Apple Health dates are ISO-like: "2024-01-15 08:30:00 -0500"
 */
function isBeforeCutoff(dateStr: string): boolean {
  if (cutoffTimestamp === null || !dateStr) return false;
  const ts = new Date(dateStr).getTime();
  // If parsing fails (NaN), don't skip — let it through
  if (Number.isNaN(ts)) return false;
  return ts < cutoffTimestamp;
}

function extractDeviceName(deviceStr: string): string {
  if (!deviceStr) return "";
  // Device string format: <<HKDevice: ..., name:iPhone, ...>>
  const nameMatch = deviceStr.match(/name:([^,>]+)/);
  return nameMatch ? nameMatch[1].trim() : "";
}

function flushBatch() {
  if (records.length > 0) {
    self.postMessage({ type: "batch", records: [...records] } satisfies WorkerBatch);
    records = [];
  }
}

function handleOpenTag(node: { name: string; attributes: Record<string, string> }) {
  const { name, attributes: attrs } = node;

  if (name === "ExportDate") {
    exportDate = attrs.value ?? null;
    return;
  }

  if (name === "Correlation") {
    insideCorrelation = true;
    correlationType = attrs.type ?? "";
    correlationRecords = [];
    return;
  }

  if (name === "Record") {
    // Skip records older than the cutoff date
    if (isBeforeCutoff(attrs.startDate ?? "")) {
      return;
    }

    const record: ParsedRecord = {
      type: attrs.type ?? "",
      value: attrs.value !== undefined ? Number.parseFloat(attrs.value) : null,
      unit: attrs.unit ?? "",
      startDate: attrs.startDate ?? "",
      endDate: attrs.endDate ?? "",
      sourceDevice: extractDeviceName(attrs.device ?? ""),
      sourceName: attrs.sourceName ?? "",
    };

    // Handle sleep analysis: value is a category (HKCategoryValueSleepAnalysis*)
    if (attrs.type === "HKCategoryTypeIdentifierSleepAnalysis") {
      // Store the sleep stage info in metadata
      const sleepStage = parseSleepStage(attrs.value ?? "");
      if (sleepStage) {
        record.metadata = { sleepStage };
      }
      // Duration in hours for sleep records
      if (record.startDate && record.endDate) {
        const start = new Date(record.startDate).getTime();
        const end = new Date(record.endDate).getTime();
        record.value = (end - start) / (1000 * 60 * 60); // hours
        record.unit = "hr";
      }
    }

    if (insideCorrelation) {
      correlationRecords.push(record);
    } else {
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
          bytesProcessed: 0,
          totalBytes: 0,
        } satisfies WorkerProgress);
      }
    }
    return;
  }

  if (name === "Workout") {
    // Skip workouts older than the cutoff date
    if (isBeforeCutoff(attrs.startDate ?? "")) {
      return;
    }

    // Convert workout to a record format
    const workoutRecord: ParsedRecord = {
      type: "HKWorkout",
      value: attrs.duration ? Number.parseFloat(attrs.duration) : null,
      unit: attrs.durationUnit ?? "min",
      startDate: attrs.startDate ?? "",
      endDate: attrs.endDate ?? "",
      sourceDevice: extractDeviceName(attrs.device ?? ""),
      sourceName: attrs.sourceName ?? "",
      metadata: {
        workoutActivityType: attrs.workoutActivityType ?? "",
        totalDistance: attrs.totalDistance ?? "",
        totalDistanceUnit: attrs.totalDistanceUnit ?? "",
        totalEnergyBurned: attrs.totalEnergyBurned ?? "",
        totalEnergyBurnedUnit: attrs.totalEnergyBurnedUnit ?? "",
      },
    };

    records.push(workoutRecord);
    totalRecords++;

    if (records.length >= BATCH_SIZE) {
      flushBatch();
    }
    return;
  }

  if (name === "ActivitySummary") {
    // Skip activity summaries older than the cutoff date
    if (isBeforeCutoff(attrs.dateComponents ?? "")) {
      return;
    }

    // Activity summaries provide daily roll-ups
    // We extract steps, distance, and energy if available
    if (attrs.activeEnergyBurned) {
      const record: ParsedRecord = {
        type: "HKActivitySummary",
        value: Number.parseFloat(attrs.activeEnergyBurned),
        unit: attrs.activeEnergyBurnedUnit ?? "kcal",
        startDate: attrs.dateComponents ?? "",
        endDate: attrs.dateComponents ?? "",
        sourceDevice: "",
        sourceName: "ActivitySummary",
        metadata: {
          activeEnergyBurned: attrs.activeEnergyBurned ?? "",
          activeEnergyBurnedGoal: attrs.activeEnergyBurnedGoal ?? "",
          moveTime: attrs.appleMoveTime ?? "",
          moveTimeGoal: attrs.appleMoveTimeGoal ?? "",
          exerciseTime: attrs.appleExerciseTime ?? "",
          exerciseTimeGoal: attrs.appleExerciseTimeGoal ?? "",
          standHours: attrs.appleStandHours ?? "",
          standHoursGoal: attrs.appleStandHoursGoal ?? "",
        },
      };

      records.push(record);
      totalRecords++;

      if (records.length >= BATCH_SIZE) {
        flushBatch();
      }
    }
    return;
  }
}

function handleCloseTag(name: string) {
  if (name === "Correlation" && insideCorrelation) {
    // For blood pressure correlations, emit both systolic and diastolic records
    if (correlationType === "HKCorrelationTypeIdentifierBloodPressure") {
      for (const record of correlationRecords) {
        records.push(record);
        totalRecords++;
      }
    }
    insideCorrelation = false;
    correlationType = "";
    correlationRecords = [];

    if (records.length >= BATCH_SIZE) {
      flushBatch();
    }
  }
}

function parseSleepStage(value: string): string | null {
  // Apple Health sleep categories
  const stageMap: Record<string, string> = {
    HKCategoryValueSleepAnalysisInBed: "inBed",
    HKCategoryValueSleepAnalysisAsleepUnspecified: "asleep",
    HKCategoryValueSleepAnalysisAsleep: "asleep",
    HKCategoryValueSleepAnalysisAwake: "awake",
    HKCategoryValueSleepAnalysisAsleepCore: "core",
    HKCategoryValueSleepAnalysisAsleepDeep: "deep",
    HKCategoryValueSleepAnalysisAsleepREM: "rem",
  };
  return stageMap[value] ?? null;
}

function initParser(cutoffDateStr?: string) {
  records = [];
  totalRecords = 0;
  exportDate = null;
  insideCorrelation = false;
  correlationType = "";
  correlationRecords = [];

  // Set the cutoff timestamp for date filtering
  if (cutoffDateStr) {
    cutoffTimestamp = new Date(cutoffDateStr).getTime();
  } else {
    cutoffTimestamp = null;
  }

  saxParser = createSaxParser(true, {
    trim: false,
    normalize: false,
  });

  saxParser.onopentag = handleOpenTag as (
    // biome-ignore lint/complexity/noBannedTypes: SAX parser type requires empty object union
    node: { name: string; attributes: Record<string, string> } | { name: string; attributes: {} },
  ) => void;
  saxParser.onclosetag = handleCloseTag;

  saxParser.onerror = (err) => {
    // SAX parser recovers from most errors, log and continue
    console.warn("SAX parser error:", err.message);
    saxParser.resume();
  };
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  try {
    if (msg.type === "start") {
      initParser(msg.cutoffDate);
      return;
    }

    if (msg.type === "chunk") {
      // Feed this chunk to the SAX parser incrementally
      saxParser.write(msg.xmlChunk);
      return;
    }

    if (msg.type === "end") {
      // Close the parser and flush remaining records
      saxParser.close();
      flushBatch();

      self.postMessage({
        type: "complete",
        totalRecords,
        exportDate,
      } satisfies WorkerComplete);
      return;
    }
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : "Unknown parsing error",
    } satisfies WorkerError);
  }
};
