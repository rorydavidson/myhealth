/**
 * Import Orchestration Service
 *
 * Orchestrates health data import pipelines:
 * - Apple Health: Stream ZIP → decompress → stream XML chunks to worker → normalize → store → summarize
 * - Health Connect: Read JSON → parse → normalize → store → summarize
 *
 * All processing happens client-side. Nothing touches the server.
 *
 * For large Apple Health exports (100MB+ ZIPs, 1-2GB+ XML), the pipeline
 * streams data through without loading the full file into memory:
 * 1. Read the ZIP file in 1MB chunks
 * 2. Feed chunks to fflate's streaming Unzip
 * 3. Decode decompressed bytes to text in ~64KB chunks
 * 4. Send text chunks to the Web Worker via postMessage
 * 5. Worker feeds chunks to SAX parser incrementally
 */

import { Unzip, UnzipInflate } from "fflate";
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

// --- Streaming ZIP extraction ---

/** Size of decoded text chunks sent to the worker (~64KB) */
const TEXT_CHUNK_SIZE = 64 * 1024;

/**
 * Stream the export.xml content from an Apple Health ZIP file
 * directly to a Web Worker, without loading the full file into memory.
 *
 * Uses fflate's streaming Unzip to decompress chunks on the fly.
 */
async function streamXmlFromZipToWorker(file: File, worker: Worker): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let foundExportXml = false;
    let finished = false;

    const unzipper = new Unzip((stream) => {
      // Check if this entry is the export.xml file
      const fileName = stream.name.split("/").pop()?.toLowerCase();
      if (fileName !== "export.xml") {
        // Skip other files in the ZIP
        stream.start();
        return;
      }

      foundExportXml = true;

      // TextDecoder for streaming UTF-8 decode
      const decoder = new TextDecoder("utf-8");
      let textBuffer = "";

      stream.ondata = (err, data, final) => {
        if (err) {
          reject(new Error(`Decompression error: ${err.message}`));
          return;
        }

        // Decode this chunk of bytes to text (stream: true keeps partial multibyte chars)
        textBuffer += decoder.decode(data, { stream: !final });

        // Send text in manageable chunks to avoid huge postMessage payloads
        while (textBuffer.length >= TEXT_CHUNK_SIZE) {
          const chunk = textBuffer.slice(0, TEXT_CHUNK_SIZE);
          textBuffer = textBuffer.slice(TEXT_CHUNK_SIZE);
          worker.postMessage({ type: "chunk", xmlChunk: chunk } satisfies WorkerMessage);
        }

        if (final) {
          // Send any remaining text
          if (textBuffer.length > 0) {
            worker.postMessage({ type: "chunk", xmlChunk: textBuffer } satisfies WorkerMessage);
            textBuffer = "";
          }
          finished = true;
          // Signal the worker that all chunks have been sent
          worker.postMessage({ type: "end" } satisfies WorkerMessage);
          resolve();
        }
      };

      stream.start();
    });

    // Register the decompression handler
    unzipper.register(UnzipInflate);

    // Read the ZIP file in chunks and feed to the unzipper
    const reader = file.stream().getReader();

    function readNextChunk() {
      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            // Signal end of ZIP input
            unzipper.push(new Uint8Array(0), true);

            // If we never found export.xml, reject
            if (!foundExportXml) {
              reject(
                new Error(
                  "Could not find export.xml in the ZIP file. Please make sure this is an Apple Health export.",
                ),
              );
            } else if (!finished) {
              // The unzip stream should have called final, but just in case
              // wait a bit for any async processing
            }
            return;
          }

          // Feed this chunk to the unzipper
          unzipper.push(value);

          // Read the next chunk
          readNextChunk();
        })
        .catch(reject);
    }

    readNextChunk();
  });
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
 * Streams the ZIP decompression and XML parsing to handle files
 * up to 2GB+ without running out of memory.
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
    // Create worker and set up message handling
    const worker = createParserWorker();

    const result = await new Promise<{ totalRecords: number; exportDate: string | null }>(
      (resolve, reject) => {
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

        // Step 1: Initialize the worker's SAX parser
        worker.postMessage({ type: "start", importId } satisfies WorkerMessage);

        // Step 2: Stream ZIP → decompress → send XML chunks to worker
        progress.phase = "parsing";
        onProgress({ ...progress });

        streamXmlFromZipToWorker(file, worker).catch((err) => {
          worker.terminate();
          reject(err);
        });
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
