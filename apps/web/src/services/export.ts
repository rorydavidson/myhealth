/**
 * Data Export/Import Service
 *
 * Exports all health data from IndexedDB to JSON (full fidelity, re-importable)
 * or CSV (human-readable per metric).
 * Imports previously exported JSON backups.
 *
 * All processing happens client-side — nothing touches the server.
 */

import {
  type AllergyRow,
  type DailySummaryRow,
  db,
  type HealthRecordRow,
  type ImportRow,
  type LabResultRow,
  type MedicationRow,
} from "@/db";

const EXPORT_VERSION = 2;

// --- Types ---

interface ExportData {
  version: number;
  exportDate: string;
  healthRecords: HealthRecordRow[];
  dailySummaries: DailySummaryRow[];
  imports: ImportRow[];
  labResults: SerializedLabResult[];
  medications?: MedicationRow[];
  allergies?: AllergyRow[];
}

interface SerializedLabResult {
  id: string;
  fileName: string;
  date: string;
  category: string;
  pdfBase64: string;
  extractedText: string;
  structuredValues: LabResultRow["structuredValues"];
  notes: string;
  createdAt: string;
}

// --- Export ---

/**
 * Export all health data as a JSON backup file.
 * Lab result PDFs are encoded as base64.
 */
export async function exportDataAsJson(): Promise<void> {
  const [healthRecords, dailySummaries, imports, labResults, medications, allergies] =
    await Promise.all([
      db.healthRecords.toArray(),
      db.dailySummaries.toArray(),
      db.imports.toArray(),
      db.labResults.toArray(),
      db.medications.toArray(),
      db.allergies.toArray(),
    ]);

  // Serialize lab results — convert PDF blobs to base64
  const serializedLabs: SerializedLabResult[] = [];
  for (const lab of labResults) {
    const arrayBuffer = await lab.pdfBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    const pdfBase64 = btoa(binary);

    serializedLabs.push({
      id: lab.id,
      fileName: lab.fileName,
      date: lab.date,
      category: lab.category,
      pdfBase64,
      extractedText: lab.extractedText,
      structuredValues: lab.structuredValues,
      notes: lab.notes,
      createdAt: lab.createdAt.toISOString(),
    });
  }

  const exportData: ExportData = {
    version: EXPORT_VERSION,
    exportDate: new Date().toISOString(),
    healthRecords,
    dailySummaries,
    imports,
    labResults: serializedLabs,
    medications,
    allergies,
  };

  const json = JSON.stringify(exportData);
  const blob = new Blob([json], { type: "application/json" });
  const fileName = `health-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`;

  downloadBlob(blob, fileName);
}

/**
 * Export health records as CSV (one CSV per metric type).
 * Downloads a single CSV containing all metrics with a "metric_type" column.
 */
export async function exportDataAsCsv(): Promise<void> {
  const records = await db.healthRecords.orderBy("[metricType+startTime]").toArray();

  if (records.length === 0) return;

  const headers = [
    "metric_type",
    "value",
    "unit",
    "start_time",
    "end_time",
    "source_platform",
    "source_device",
    "source_type",
  ];

  const rows = records.map((r) => [
    r.metricType,
    r.value?.toString() ?? "",
    r.unit,
    r.startTime instanceof Date ? r.startTime.toISOString() : String(r.startTime),
    r.endTime instanceof Date ? r.endTime.toISOString() : String(r.endTime),
    r.sourcePlatform,
    r.sourceDevice,
    r.sourceType,
  ]);

  const csvContent = [headers.join(","), ...rows.map((row) => row.map(escapeCsv).join(","))].join(
    "\n",
  );

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const fileName = `health-data-${new Date().toISOString().slice(0, 10)}.csv`;

  downloadBlob(blob, fileName);
}

// --- Import ---

/**
 * Import a previously exported JSON backup.
 * Merges with existing data using deduplication (records with same ID are overwritten).
 */
export async function importDataFromJson(file: File): Promise<{ recordCount: number }> {
  const text = await file.text();
  const data = JSON.parse(text) as ExportData;

  if (!data.version || !data.healthRecords) {
    throw new Error("Invalid backup file format");
  }

  // Import health records
  if (data.healthRecords.length > 0) {
    // Ensure dates are proper Date objects
    const records = data.healthRecords.map((r) => ({
      ...r,
      startTime: new Date(r.startTime),
      endTime: new Date(r.endTime),
    }));
    await db.healthRecords.bulkPut(records);
  }

  // Import daily summaries
  if (data.dailySummaries?.length > 0) {
    await db.dailySummaries.bulkPut(data.dailySummaries);
  }

  // Import import history
  if (data.imports?.length > 0) {
    const imports = data.imports.map((imp) => ({
      ...imp,
      startedAt: new Date(imp.startedAt),
      completedAt: imp.completedAt ? new Date(imp.completedAt) : null,
      dateRange: imp.dateRange
        ? { earliest: new Date(imp.dateRange.earliest), latest: new Date(imp.dateRange.latest) }
        : null,
    }));
    await db.imports.bulkPut(imports);
  }

  // Import lab results
  if (data.labResults?.length > 0) {
    for (const lab of data.labResults) {
      // Convert base64 back to Blob
      const binary = atob(lab.pdfBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const pdfBlob = new Blob([bytes], { type: "application/pdf" });

      const labRow: LabResultRow = {
        id: lab.id,
        fileName: lab.fileName,
        date: lab.date,
        category: lab.category,
        pdfBlob,
        extractedText: lab.extractedText,
        structuredValues: lab.structuredValues,
        notes: lab.notes,
        createdAt: new Date(lab.createdAt),
      };

      await db.labResults.put(labRow);
    }
  }

  // Import medications
  if (data.medications && data.medications.length > 0) {
    const medications = data.medications.map((m) => ({
      ...m,
      createdAt: new Date(m.createdAt),
    }));
    await db.medications.bulkPut(medications);
  }

  // Import allergies
  if (data.allergies && data.allergies.length > 0) {
    const allergies = data.allergies.map((a) => ({
      ...a,
      createdAt: new Date(a.createdAt),
    }));
    await db.allergies.bulkPut(allergies);
  }

  // Recompute summaries if we imported raw records but no summaries
  if (data.healthRecords.length > 0 && (!data.dailySummaries || data.dailySummaries.length === 0)) {
    const { recomputeAllSummaries } = await import("./aggregate");
    await recomputeAllSummaries();
  }

  return { recordCount: data.healthRecords.length };
}

/**
 * Clear all health data from IndexedDB.
 */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.healthRecords.clear(),
    db.dailySummaries.clear(),
    db.imports.clear(),
    db.labResults.clear(),
    db.medications.clear(),
    db.allergies.clear(),
  ]);
}

// --- Utilities ---

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

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
