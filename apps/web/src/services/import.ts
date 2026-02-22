/**
 * Import Orchestration Service
 *
 * Orchestrates health data import pipelines:
 * - Apple Health: Extract ZIP → parse XML → normalize → store → summarize
 * - Health Connect: Read JSON → parse → normalize → store → summarize
 *
 * All processing happens client-side. Nothing touches the server.
 */

import { strFromU8, unzipSync } from "fflate";
import { db, type HealthRecordRow, type ImportRow } from "@/db";
import type {
  WorkerBatch,
  WorkerComplete,
  WorkerError,
  WorkerMessage,
  WorkerProgress,
} from "@/workers/apple-health-parser.worker";
import type {
  HCWorkerBatch,
  HCWorkerComplete,
  HCWorkerError,
  HCWorkerMessage,
  HCWorkerProgress,
} from "@/workers/health-connect-parser.worker";
import { computeDailySummaries } from "./aggregate";
import { normalizeAppleHealthRecords, normalizeHealthConnectRecords } from "./normalize";

// --- Import state types ---

export type ImportPhase =
  | "idle"
  | "reading_zip"
  | "parsing"
  | "storing"
  | "computing_summaries"
  | "complete"
  | "failed";

export interface ImportProgress {
  phase: ImportPhase;
  recordsParsed: number;
  recordsStored: number;
  totalRecords: number;
  summariesComputed: number;
  error?: string;
  fileName: string;
}

export type ImportProgressCallback = (progress: ImportProgress) => void;

// --- ZIP extraction ---

/**
 * Extract the export.xml content from an Apple Health ZIP file.
 * Apple Health exports contain a top-level "apple_health_export/" directory
 * with "export.xml" inside.
 */
async function extractXmlFromZip(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  const unzipped = unzipSync(uint8);

  // Find export.xml — may be at root or inside apple_health_export/
  for (const [path, data] of Object.entries(unzipped)) {
    const fileName = path.split("/").pop()?.toLowerCase();
    if (fileName === "export.xml") {
      return strFromU8(data);
    }
  }

  throw new Error(
    "Could not find export.xml in the ZIP file. Please make sure this is an Apple Health export.",
  );
}

// --- Worker management ---

function createParserWorker(): Worker {
  return new Worker(new URL("@/workers/apple-health-parser.worker.ts", import.meta.url), {
    type: "module",
  });
}

function createHealthConnectWorker(): Worker {
  return new Worker(new URL("@/workers/health-connect-parser.worker.ts", import.meta.url), {
    type: "module",
  });
}

// --- Batch storage ---

/**
 * Store normalized records in IndexedDB using bulkPut for deduplication.
 * Records with the same deterministic ID will be upserted (overwritten).
 */
async function storeRecordBatch(records: HealthRecordRow[]): Promise<number> {
  if (records.length === 0) return 0;
  await db.healthRecords.bulkPut(records);
  return records.length;
}

// --- Main import function ---

/**
 * Import an Apple Health ZIP export file.
 *
 * @param file - The ZIP file from the user's file picker / drop
 * @param onProgress - Callback for progress updates
 * @returns The import ID and record count
 */
export async function importAppleHealthFile(
  file: File,
  onProgress: ImportProgressCallback,
): Promise<{ importId: string; recordCount: number }> {
  const importId = crypto.randomUUID();
  const fileName = file.name;

  const progress: ImportProgress = {
    phase: "reading_zip",
    recordsParsed: 0,
    recordsStored: 0,
    totalRecords: 0,
    summariesComputed: 0,
    fileName,
  };

  // Create import record
  const importRecord: ImportRow = {
    id: importId,
    platform: "apple_health",
    fileName,
    exportDate: "",
    startedAt: new Date(),
    completedAt: null,
    recordCount: 0,
    status: "processing",
    dateRange: null,
  };

  await db.imports.put(importRecord);
  onProgress({ ...progress });

  try {
    // Step 1: Extract ZIP
    const xmlContent = await extractXmlFromZip(file);

    // Step 2: Parse XML in Web Worker
    progress.phase = "parsing";
    onProgress({ ...progress });

    const result = await new Promise<{ totalRecords: number; exportDate: string | null }>(
      (resolve, reject) => {
        const worker = createParserWorker();

        // Collect batches and store them as they arrive
        let storageQueue = Promise.resolve();

        worker.onmessage = (
          event: MessageEvent<WorkerBatch | WorkerProgress | WorkerComplete | WorkerError>,
        ) => {
          const msg = event.data;

          if (msg.type === "batch") {
            progress.recordsParsed += msg.records.length;
            progress.phase = "storing";
            onProgress({ ...progress });

            // Queue storage operations sequentially
            storageQueue = storageQueue.then(async () => {
              const normalized = await normalizeAppleHealthRecords(msg.records, importId);
              await storeRecordBatch(normalized);
              progress.recordsStored += normalized.length;
              onProgress({ ...progress });
            });
          }

          if (msg.type === "progress") {
            progress.recordsParsed = msg.recordsParsed;
            progress.phase = "parsing";
            onProgress({ ...progress });
          }

          if (msg.type === "complete") {
            // Wait for all storage to finish before resolving
            storageQueue
              .then(() => {
                progress.totalRecords = msg.totalRecords;
                worker.terminate();
                resolve({
                  totalRecords: msg.totalRecords,
                  exportDate: msg.exportDate,
                });
              })
              .catch(reject);
          }

          if (msg.type === "error") {
            worker.terminate();
            reject(new Error(msg.message));
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          reject(new Error(err.message || "Worker error"));
        };

        // Start the worker
        worker.postMessage({
          type: "start",
          xmlContent,
          importId,
        } satisfies WorkerMessage);
      },
    );

    // Step 3: Compute daily summaries
    progress.phase = "computing_summaries";
    onProgress({ ...progress });

    const summaryCount = await computeDailySummaries(importId);
    progress.summariesComputed = summaryCount;

    // Step 4: Compute date range
    const storedRecords = await db.healthRecords
      .where("importId")
      .equals(importId)
      .sortBy("startTime");

    const dateRange =
      storedRecords.length > 0
        ? {
            earliest: storedRecords[0].startTime,
            latest: storedRecords[storedRecords.length - 1].startTime,
          }
        : null;

    // Update import record
    await db.imports.update(importId, {
      status: "completed",
      completedAt: new Date(),
      recordCount: progress.recordsStored,
      exportDate: result.exportDate ?? "",
      dateRange,
    });

    progress.phase = "complete";
    onProgress({ ...progress });

    return { importId, recordCount: progress.recordsStored };
  } catch (err) {
    // Mark import as failed
    await db.imports.update(importId, {
      status: "failed",
      completedAt: new Date(),
    });

    progress.phase = "failed";
    progress.error = err instanceof Error ? err.message : "Unknown error";
    onProgress({ ...progress });

    throw err;
  }
}

// --- Google Health Connect import ---

/**
 * Import a Google Health Connect JSON export file.
 *
 * @param file - The JSON file from the user's file picker / drop
 * @param onProgress - Callback for progress updates
 * @returns The import ID and record count
 */
export async function importHealthConnectFile(
  file: File,
  onProgress: ImportProgressCallback,
): Promise<{ importId: string; recordCount: number }> {
  const importId = crypto.randomUUID();
  const fileName = file.name;

  const progress: ImportProgress = {
    phase: "reading_zip", // reuse "reading_zip" as "reading file"
    recordsParsed: 0,
    recordsStored: 0,
    totalRecords: 0,
    summariesComputed: 0,
    fileName,
  };

  const importRecord: ImportRow = {
    id: importId,
    platform: "health_connect",
    fileName,
    exportDate: "",
    startedAt: new Date(),
    completedAt: null,
    recordCount: 0,
    status: "processing",
    dateRange: null,
  };

  await db.imports.put(importRecord);
  onProgress({ ...progress });

  try {
    // Step 1: Read JSON
    const jsonContent = await file.text();

    // Step 2: Parse JSON in Web Worker
    progress.phase = "parsing";
    onProgress({ ...progress });

    const result = await new Promise<{ totalRecords: number; exportDate: string | null }>(
      (resolve, reject) => {
        const worker = createHealthConnectWorker();
        let storageQueue = Promise.resolve();

        worker.onmessage = (
          event: MessageEvent<HCWorkerBatch | HCWorkerProgress | HCWorkerComplete | HCWorkerError>,
        ) => {
          const msg = event.data;

          if (msg.type === "batch") {
            progress.recordsParsed += msg.records.length;
            progress.phase = "storing";
            onProgress({ ...progress });

            storageQueue = storageQueue.then(async () => {
              const normalized = await normalizeHealthConnectRecords(msg.records, importId);
              await storeRecordBatch(normalized);
              progress.recordsStored += normalized.length;
              onProgress({ ...progress });
            });
          }

          if (msg.type === "progress") {
            progress.recordsParsed = msg.recordsParsed;
            progress.phase = "parsing";
            onProgress({ ...progress });
          }

          if (msg.type === "complete") {
            storageQueue
              .then(() => {
                progress.totalRecords = msg.totalRecords;
                worker.terminate();
                resolve({
                  totalRecords: msg.totalRecords,
                  exportDate: msg.exportDate,
                });
              })
              .catch(reject);
          }

          if (msg.type === "error") {
            worker.terminate();
            reject(new Error(msg.message));
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          reject(new Error(err.message || "Worker error"));
        };

        worker.postMessage({
          type: "start",
          jsonContent,
          importId,
        } satisfies HCWorkerMessage);
      },
    );

    // Step 3: Compute daily summaries
    progress.phase = "computing_summaries";
    onProgress({ ...progress });

    const summaryCount = await computeDailySummaries(importId);
    progress.summariesComputed = summaryCount;

    // Step 4: Compute date range
    const storedRecords = await db.healthRecords
      .where("importId")
      .equals(importId)
      .sortBy("startTime");

    const dateRange =
      storedRecords.length > 0
        ? {
            earliest: storedRecords[0].startTime,
            latest: storedRecords[storedRecords.length - 1].startTime,
          }
        : null;

    await db.imports.update(importId, {
      status: "completed",
      completedAt: new Date(),
      recordCount: progress.recordsStored,
      exportDate: result.exportDate ?? "",
      dateRange,
    });

    progress.phase = "complete";
    onProgress({ ...progress });

    return { importId, recordCount: progress.recordsStored };
  } catch (err) {
    await db.imports.update(importId, {
      status: "failed",
      completedAt: new Date(),
    });

    progress.phase = "failed";
    progress.error = err instanceof Error ? err.message : "Unknown error";
    onProgress({ ...progress });

    throw err;
  }
}

/**
 * Get all import records, sorted by most recent first.
 */
export async function getImportHistory(): Promise<ImportRow[]> {
  return db.imports.orderBy("id").reverse().toArray();
}

/**
 * Delete all records from a specific import and recompute summaries.
 */
export async function deleteImport(importId: string): Promise<void> {
  await db.healthRecords.where("importId").equals(importId).delete();
  await db.imports.delete(importId);

  // Recompute all summaries since we removed records
  const { recomputeAllSummaries } = await import("./aggregate");
  await recomputeAllSummaries();
}

/**
 * Get storage usage statistics.
 */
export async function getStorageStats(): Promise<{
  recordCount: number;
  summaryCount: number;
  importCount: number;
  labResultCount: number;
}> {
  const [recordCount, summaryCount, importCount, labResultCount] = await Promise.all([
    db.healthRecords.count(),
    db.dailySummaries.count(),
    db.imports.count(),
    db.labResults.count(),
  ]);

  return { recordCount, summaryCount, importCount, labResultCount };
}
