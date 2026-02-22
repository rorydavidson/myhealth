/**
 * Lab results service — handles PDF upload, text extraction, and value parsing.
 *
 * All processing happens client-side. PDFs are stored as blobs in IndexedDB.
 * Text extraction uses pdf.js (Mozilla's client-side PDF renderer).
 */

import { LAB_CODING } from "@health-app/shared";
import { db, type LabResultRow } from "@/db";

export type LabCategory = "blood_panel" | "lipid_panel" | "thyroid" | "metabolic" | "other";

export interface StructuredValue {
  value: number;
  unit: string;
  flag?: string;
  referenceRange?: string;
  loincCode?: string;
}

/**
 * Extract text from a PDF file using pdf.js.
 * Runs entirely in the browser — no server calls.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  // Set the worker source to use the bundled worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push(pageText);
  }

  return pages.join("\n\n");
}

/**
 * Best-effort extraction of structured lab values from raw text.
 * Looks for common patterns like "Test Name: 123 mg/dL (60-100)"
 */
export function extractStructuredValues(text: string): Record<string, StructuredValue> {
  const values: Record<string, StructuredValue> = {};

  // Common patterns for lab result values
  // Pattern: TestName value unit (ref range) or TestName: value unit [ref range]
  const patterns = [
    // "Glucose 95 mg/dL 70-100" or "Glucose: 95 mg/dL (70-100)"
    /([A-Za-z][\w\s/]+?)\s*[:-]?\s*(\d+\.?\d*)\s*(mg\/dL|g\/dL|mmol\/L|mIU\/L|%|U\/L|ng\/mL|pg\/mL|fL|x10\^?\d*\/[uμ]L|mcg\/dL|nmol\/L|pmol\/L|mEq\/L|mm\/hr|cells\/[uμ]L)\s*(?:\(?([<>]?\s*\d+\.?\d*\s*[-–]\s*\d+\.?\d*)\)?)?/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null = pattern.exec(text);
    while (match !== null) {
      const testName = match[1].trim();
      const value = Number.parseFloat(match[2]);
      const unit = match[3];
      const referenceRange = match[4]?.trim() || undefined;

      if (Number.isNaN(value)) continue;

      // Normalize test name for LOINC lookup
      const normalizedName = testName.toLowerCase().trim();
      const labCode = LAB_CODING[normalizedName];

      // Determine flag based on reference range
      let flag: string | undefined;
      if (referenceRange) {
        flag = determineFlag(value, referenceRange);
      }

      // Use the original test name as key (for display)
      values[testName] = {
        value,
        unit,
        flag,
        referenceRange,
        loincCode: labCode?.code,
      };
      match = pattern.exec(text);
    }
  }

  return values;
}

/**
 * Determine if a value is within, above, or below the reference range.
 */
function determineFlag(value: number, referenceRange: string): string | undefined {
  const rangeMatch = referenceRange.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
  if (!rangeMatch) return undefined;

  const low = Number.parseFloat(rangeMatch[1]);
  const high = Number.parseFloat(rangeMatch[2]);

  if (value < low) return "low";
  if (value > high) return "high";
  return "normal";
}

/**
 * Save a lab result to IndexedDB.
 */
export async function saveLabResult(params: {
  file: File;
  date: string;
  category: LabCategory;
  notes?: string;
  extractedText: string;
  structuredValues: Record<string, StructuredValue>;
}): Promise<string> {
  const id = crypto.randomUUID();

  const row: LabResultRow = {
    id,
    fileName: params.file.name,
    date: params.date,
    category: params.category,
    pdfBlob: new Blob([await params.file.arrayBuffer()], { type: "application/pdf" }),
    extractedText: params.extractedText,
    structuredValues: params.structuredValues,
    notes: params.notes ?? "",
    createdAt: new Date(),
  };

  await db.labResults.put(row);
  return id;
}

/**
 * Get all lab results sorted by date descending.
 */
export async function getLabResults(): Promise<LabResultRow[]> {
  return db.labResults.orderBy("date").reverse().toArray();
}

/**
 * Delete a lab result.
 */
export async function deleteLabResult(id: string): Promise<void> {
  await db.labResults.delete(id);
}

/**
 * Update notes for a lab result.
 */
export async function updateLabNotes(id: string, notes: string): Promise<void> {
  await db.labResults.update(id, { notes });
}

/**
 * Get a PDF blob URL for viewing.
 */
export function createPdfUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
