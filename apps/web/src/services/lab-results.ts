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

    // Reconstruct line breaks from the vertical position of each text item.
    // pdfjs items have a `transform` matrix; transform[5] is the y-coordinate.
    // When y changes significantly between consecutive items we emit a newline
    // rather than a space, which preserves the row structure that the parser
    // relies on to match test names, values, and reference ranges.
    const lines: string[] = [];
    let currentLine = "";
    let lastY: number | null = null;
    const Y_THRESHOLD = 2; // points — same line if Δy < this value

    for (const item of textContent.items) {
      if (!("str" in item)) continue;
      const str = item.str;
      if (!str) continue;

      const y = (item as { transform: number[] }).transform[5];

      if (lastY === null || Math.abs(y - lastY) < Y_THRESHOLD) {
        // Same line — append with a space only if there's already content
        currentLine = currentLine ? currentLine + str : str;
      } else {
        // New line
        if (currentLine) lines.push(currentLine);
        currentLine = str;
      }
      lastY = y;
    }
    if (currentLine) lines.push(currentLine);

    pages.push(lines.join("\n"));
  }

  return pages.join("\n\n");
}

/**
 * Units recognised in lab reports.
 * Covers both English and French/European lab formats.
 *
 * Order matters: longer/more-specific tokens must come before shorter ones
 * so the regex engine is greedy enough to capture the full unit string.
 */
const UNIT_PATTERN =
  // Concentration / substance
  "mmol\\/L|µmol\\/L|μmol\\/L|umol\\/L|nmol\\/L|pmol\\/L|mol\\/L|" +
  "mg\\/dL|mg\\/L|µg\\/L|μg\\/L|ug\\/L|ng\\/mL|ng\\/dL|ng\\/L|pg\\/mL|" +
  "g\\/dL|g\\/L|" +
  // Activity / enzyme
  "U\\/L|UI\\/L|mUI\\/L|IU\\/L|mIU\\/L|kU\\/L|" +
  // Haematology counts
  "T\\/L|G\\/L|x10\\^?9\\/L|10\\^?9\\/L|" +
  "x10\\^?12\\/L|10\\^?12\\/L|" +
  "x10\\^?\\d*\\/[uµμ]L|" +
  "cells\\/[uµμ]L|" +
  // Volume
  "fL|pL|" +
  // Mass
  "pg|" +
  // Ratio / percent
  "%|" +
  // Pressure / rate
  "mmHg|mm\\/hr|breaths\\/min|" +
  // Misc
  "mEq\\/L|mOsm\\/kg";

/**
 * Regex that finds a numeric value (dot or comma decimal) immediately followed
 * by a recognised unit, optionally with whitespace between them.
 *
 * Captures: [1] numeric string  [2] unit string
 */
const VALUE_UNIT_RE = new RegExp(
  `(\\d+[.,]\\d+|\\d+)\\s*(${UNIT_PATTERN})`,
  "i",
);

/**
 * Regex that matches a reference-range line such as:
 *   ( 4,60 - 6,20 )   or   ( 13,0 - 18,0 )   or   ( < 10 )   or   > 7,00
 */
const REF_RANGE_RE =
  /^\s*\(?\s*(?:[<>]\s*)?(\d+[.,]?\d*)\s*[-–]\s*(\d+[.,]?\d*)\s*\)?\s*$|^\s*\(?\s*[<>]\s*\d+[.,]?\d*\s*\)?\s*$/;

/**
 * Lines that are pure noise and should never be used as a test name.
 * These are section headers, footers, lab metadata, and instrument lines
 * that appear between data rows in French lab report PDFs.
 */
const NOISE_RE =
  /^\s*$|page\s+\d|valeurs\s+de|antériorité|résultats|prescription|dr\s+|laboratoire|exemplaire|édité|prélevé|dossier|biologiste|accréditation|spectro|cytom|impéd|culture|clinique|contexte|aspect|limpide|absence|conclusion|biochimie\s+sanguine|hematocytologie|hématocytologie|hormonologie|auto-immunit|sérologie|microbiologie|formule\s+leuc|numération|electrophorèse|électrophorèse|st\s+médard|léognan|selas|pauillac|haillan|floirac|latresne|eysines|lormont|cenon|ambarès|créon|martignas/i;

/**
 * Parse a numeric string that may use either a dot or a comma as the
 * decimal separator (European style).
 */
function parseEuropeanFloat(s: string): number {
  return Number.parseFloat(s.replace(",", "."));
}

/**
 * Best-effort extraction of structured lab values from raw text.
 *
 * Strategy:
 *   1. Split text into lines.
 *   2. For each line that contains a value+unit token, capture the value/unit.
 *   3. Look at the surrounding ±3 lines for a reference range and a test name.
 *   4. Normalise the test name and attempt a LOINC lookup.
 *
 * This handles multi-column French lab report PDFs where the text stream
 * emits value+unit on one line, the reference range on the next, and the
 * test name either before or after — rather than the left-to-right
 * "Name: value unit (range)" layout assumed by a simple single-pass regex.
 */
export function extractStructuredValues(text: string): Record<string, StructuredValue> {
  const values: Record<string, StructuredValue> = {};
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = VALUE_UNIT_RE.exec(line);
    if (!match) continue;

    const rawValue = match[1];
    const unit = match[2];
    const value = parseEuropeanFloat(rawValue);
    if (Number.isNaN(value)) continue;

    // --- Find reference range in the forward window (lines after the value) ---
    // In French lab PDFs (and most other formats) the reference range always
    // appears immediately after the value line — never before it. Searching
    // backwards would risk picking up the previous test's reference range.
    // We stop the search as soon as we cross another value+unit line.
    let referenceRange: string | undefined;
    for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
      const candidate = lines[j].trim();
      // Stop if we've crossed into the next result's value line
      if (VALUE_UNIT_RE.test(candidate)) break;
      if (REF_RANGE_RE.test(candidate)) {
        referenceRange = candidate.replace(/[()]/g, "").trim();
        break;
      }
    }

    // --- Find test name in the surrounding lines ---
    // In French lab PDFs (BIOLAB33 and similar) the layout is:
    //   value+unit          ← line i
    //   ( ref range )       ← line i+1
    //   TEST NAME           ← line i+2
    // so we prefer lines *after* the value over lines *before* it.
    // We also check i-1 and i-2 as fallback for formats where the name
    // comes first (English-style reports).
    let testName: string | undefined;
    const nameWindow = [i + 1, i + 2, i + 3, i - 1, i - 2, i - 3];
    for (const j of nameWindow) {
      if (j < 0 || j >= lines.length) continue;
      const candidate = lines[j].trim();

      // Skip if it's a ref range, a value+unit line, a bare number, or noise
      if (REF_RANGE_RE.test(candidate)) continue;
      if (VALUE_UNIT_RE.test(candidate)) continue;
      if (/^\d+[.,]?\d*$/.test(candidate)) continue;
      if (NOISE_RE.test(candidate)) continue;
      // Must contain at least 2 letters (not necessarily consecutive — covers
      // dotted abbreviations like "V.G.M." and "T.C.M.H.")
      if (!/[A-Za-zÀ-ÖØ-öø-ÿ].*[A-Za-zÀ-ÖØ-öø-ÿ]/s.test(candidate)) continue;
      // Reasonable length
      if (candidate.length < 2 || candidate.length > 80) continue;

      testName = candidate;
      break;
    }

    if (!testName) continue;

    // Clean up test name: strip trailing flag markers and whitespace
    testName = testName.replace(/\s*[*#]\s*$/, "").trim();

    // Determine flag from reference range
    let flag: string | undefined;
    if (referenceRange) {
      flag = determineFlag(value, referenceRange);
    }

    // LOINC lookup — try progressively normalised forms
    const loincCode = lookupLoincCode(testName);

    // Deduplicate: if we already have an entry for this name, keep it
    if (!(testName in values)) {
      values[testName] = { value, unit, flag, referenceRange, loincCode };
    }
  }

  return values;
}

/**
 * Try to find a LOINC code for a test name.
 * Attempts: exact lowercase, without parenthetical suffixes, French → English aliases.
 */
function lookupLoincCode(testName: string): string | undefined {
  const attempts = [
    testName.toLowerCase(),
    testName.toLowerCase().replace(/\s*\(.*?\)/, "").trim(),
    testName.toLowerCase().replace(/\s*#$/, "").trim(),
  ];

  for (const key of attempts) {
    const entry = LAB_CODING[key];
    if (entry) return entry.code;
  }
  return undefined;
}

/**
 * Determine if a value is within, above, or below the reference range.
 *
 * Handles three range formats (with dot or comma decimals):
 *   "4,60 - 6,20"   →  low–high interval
 *   "< 50"          →  upper-bound only  (value must be below)
 *   "> 1,03"        →  lower-bound only  (value must be above)
 */
function determineFlag(value: number, referenceRange: string): string | undefined {
  // Number token: digits with optional decimal part (dot or comma separator)
  const NUM = "(\\d+[.,]\\d+|\\d+)";

  // Two-sided range: "4,60 - 6,20" or "4.60 - 6.20" or "79 - 97"
  const twoSided = referenceRange.match(new RegExp(`${NUM}\\s*[-–]\\s*${NUM}`));
  if (twoSided) {
    const low = parseEuropeanFloat(twoSided[1]);
    const high = parseEuropeanFloat(twoSided[2]);
    if (value < low) return "low";
    if (value > high) return "high";
    return "normal";
  }

  // One-sided upper bound: "< 50" or "< 5,6"
  const upperOnly = referenceRange.match(new RegExp(`<\\s*${NUM}`));
  if (upperOnly) {
    return value >= parseEuropeanFloat(upperOnly[1]) ? "high" : "normal";
  }

  // One-sided lower bound: "> 1,03"
  const lowerOnly = referenceRange.match(new RegExp(`>\\s*${NUM}`));
  if (lowerOnly) {
    return value <= parseEuropeanFloat(lowerOnly[1]) ? "low" : "normal";
  }

  return undefined;
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
