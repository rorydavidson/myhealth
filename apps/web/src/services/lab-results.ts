/**
 * Lab results service — handles PDF upload, text extraction, and value parsing.
 *
 * All processing happens client-side. PDFs are stored as blobs in IndexedDB.
 * Text extraction uses pdf.js (Mozilla's client-side PDF renderer).
 */

import { LAB_CODING } from "@health-app/shared";
import { db, type LabResultRow } from "@/db";
// Vite's `?worker` modifier bundles the pdfjs worker correctly for the
// browser (dev + prod). We then hand the resulting Worker instance directly
// to PDFWorker.create({ port }) so pdfjs never tries to fetch a workerSrc
// URL — sidestepping the "Setting up fake worker failed" error entirely.
import PdfjsWorkerClass from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

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

  // Create the pdfjs worker using Vite's bundled Worker class, then wrap it
  // in a PDFWorker so pdfjs owns the lifetime. Passing it directly to
  // getDocument() means pdfjs never has to fetch or import() a workerSrc URL.
  const browserWorker = new PdfjsWorkerClass() as Worker;
  const pdfWorker = pdfjsLib.PDFWorker.create({ port: browserWorker });

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, worker: pdfWorker }).promise;

  // transform[4] = x (horizontal offset from left edge, points)
  // transform[5] = y (vertical offset from bottom edge, points — higher = higher on page)
  type PdfItem = { x: number; y: number; str: string };

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Reconstruct reading order from the (x, y) position of each text item.
    //
    // pdfjs returns items in content-stream order, which is NOT necessarily
    // reading order — in multi-column lab report PDFs items from different
    // rows can be interleaved. Comparing consecutive items' Y values (the
    // previous approach) therefore produced garbage lines.
    //
    // Fix: collect all items with their positions, sort top→bottom then
    // left→right, group items whose Y values are within Y_THRESHOLD into the
    // same logical line, then join each group left-to-right.

    const rawItems: PdfItem[] = [];

    for (const item of textContent.items) {
      if (!("str" in item)) continue;
      const str = item.str;
      if (!str) continue;
      const t = (item as { transform: number[] }).transform;
      rawItems.push({ x: t[4], y: t[5], str });
    }

    // Sort by Y descending (top of page first), then by X ascending (left→right)
    rawItems.sort((a, b) => b.y - a.y || a.x - b.x);

    // Group into lines: items whose Y is within Y_THRESHOLD of the group's
    // anchor Y are considered on the same visual row.
    const Y_THRESHOLD = 3; // points
    const lines: string[] = [];
    let groupY: number | null = null;
    let groupItems: PdfItem[] = [];

    const flushGroup = () => {
      if (groupItems.length === 0) return;
      // Within the group, sort by X then concatenate (no extra space — pdfjs
      // already encodes inter-word spacing inside the str values or via item gaps)
      groupItems.sort((a, b) => a.x - b.x);
      const line = groupItems.map((it) => it.str).join("");
      if (line.trim()) lines.push(line);
      groupItems = [];
      groupY = null;
    };

    for (const item of rawItems) {
      if (groupY === null || Math.abs(item.y - groupY) < Y_THRESHOLD) {
        if (groupY === null) groupY = item.y;
        groupItems.push(item);
      } else {
        flushGroup();
        groupY = item.y;
        groupItems = [item];
      }
    }
    flushGroup();

    pages.push(lines.join("\n"));
  }

  pdfWorker.destroy();
  return pages.join("\n\n");
}

// ---------------------------------------------------------------------------
// Date extraction
// ---------------------------------------------------------------------------

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 1,
  février: 2,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  août: 8,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  décembre: 12,
  decembre: 12,
};

const ENGLISH_MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

// Matches YYYY-MM-DD (ISO) — skip LOINC-style codes by requiring full 4-digit year
const ISO_DATE_RE = /\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/;

// Matches DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (European / French convention)
const DMY_RE = /\b(0?[1-9]|[12]\d|3[01])[/\-.](0?[1-9]|1[0-2])[/\-.](20\d{2})\b/;

// Matches "25 juillet 2025" / "25 July 2025"
const MONTH_NAME_RE = new RegExp(
  String.raw`\b(\d{1,2})\s+(` +
    [
      ...Object.keys(FRENCH_MONTHS),
      ...Object.keys(ENGLISH_MONTHS).filter((m) => !(m in FRENCH_MONTHS)),
    ].join("|") +
    String.raw`)\s+(20\d{2})\b`,
  "i",
);

// Keywords that appear near the specimen/report date in lab PDFs
const LAB_DATE_KEYWORD_RE =
  /prélevé|prélèvement|prélévement|prelevement|collecté|collection|date\s+d[eu']\s*\w|analyse|résultat|rapport|collected|drawn|received|report\s+date|test\s+date|date\s+of|date\s*:/i;

function parseDateFromLine(line: string): string | null {
  // ISO first — unambiguous
  const iso = ISO_DATE_RE.exec(line);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Named month: "25 juillet 2025"
  const named = MONTH_NAME_RE.exec(line);
  if (named) {
    const d = named[1].padStart(2, "0");
    const m = FRENCH_MONTHS[named[2].toLowerCase()] ?? ENGLISH_MONTHS[named[2].toLowerCase()];
    const y = named[3];
    if (m) return `${y}-${String(m).padStart(2, "0")}-${d}`;
  }

  // DD/MM/YYYY (French convention)
  const dmy = DMY_RE.exec(line);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;

  return null;
}

/**
 * Try to extract a report/collection date from raw PDF text.
 *
 * Strategy:
 *   1. Scan all lines for one that contains a lab keyword *and* a recognisable
 *      date — this catches "Prélevé le 25/07/2025" reliably.
 *   2. Fall back to the first date-like pattern in the first 80 lines (header
 *      area of the report).
 *
 * Returns an ISO 8601 YYYY-MM-DD string or null if nothing is found.
 */
export function extractDateFromText(text: string): string | null {
  const lines = text.split("\n");

  // Pass 1: keyword-associated lines anywhere in the document
  for (const line of lines) {
    if (!LAB_DATE_KEYWORD_RE.test(line)) continue;
    const date = parseDateFromLine(line);
    if (date) return date;
  }

  // Pass 2: any date in the first 80 lines (report header)
  for (const line of lines.slice(0, 80)) {
    const date = parseDateFromLine(line);
    if (date) return date;
  }

  return null;
}

/**
 * Number of calendar days between a lab result date and today.
 * Used when building LLM context so insights are framed relative to
 * the current date rather than relying on the AI to compute this.
 *
 * Always computed at call time — never cached — so it reflects today's date
 * whenever an insights request is made.
 */
export function labResultAgeDays(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const resultDate = new Date(date);
  resultDate.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - resultDate.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------

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
 *   ( 4.5 à 5.7 )     ← French "à" separator used in Synlab / French lab reports
 */
const REF_RANGE_RE =
  /^\s*\(?\s*(?:[<>]\s*)?(\d+[.,]?\d*)\s*(?:[-–]|à)\s*(\d+[.,]?\d*)\s*\)?\s*$|^\s*\(?\s*[<>]\s*\d+[.,]?\d*\s*\)?\s*$/;

/**
 * Lines that are pure noise and should never be used as a test name.
 * These are section headers, footers, lab metadata, and instrument lines
 * that appear between data rows in French lab report PDFs.
 *
 * Instrument/method patterns (colorim, chimioluminesc, …) filter out the
 * analytical-method annotation lines that Synlab and similar labs emit
 * immediately after each result row (e.g. "Colorimétrie enzymatique - - SIEMENS").
 */
const NOISE_RE =
  /^\s*$|page\s+\d|valeurs\s+de|antériorité|résultats|prescription|dr\s+|laboratoire|exemplaire|édité|prélevé|dossier|biologiste|accréditation|spectro|cytom|impéd|culture|clinique|contexte|aspect|limpide|absence|conclusion|biochimie\s+sanguine|hematocytologie|hématocytologie|hormonologie|auto-immunit|sérologie|microbiologie|formule\s+leuc|numération|electrophorèse|électrophorèse|st\s+médard|léognan|selas|pauillac|haillan|floirac|latresne|eysines|lormont|cenon|ambarès|créon|martignas|colorim|chimioluminesc|potentiomét|immunoturbidim|siemens|sysmex|automate|spectrométr|turbidimét|néphélomét|électrochim|fluorescenc|comptage\s+différ|objectif\s+thérapeutiq|objectif\s+lipidique/i;

/**
 * Parse a numeric string that may use either a dot or a comma as the
 * decimal separator (European style).
 */
function parseEuropeanFloat(s: string): number {
  return Number.parseFloat(s.replace(",", "."));
}

/** Matches a bare flagged-value line like "* 25.9" (no unit) emitted by French lab PDFs. */
const FLAGGED_NUM_RE = /^\*\s*(\d+[.,]?\d*)$/;

/**
 * Best-effort extraction of structured lab values from raw text.
 *
 * Strategy:
 *   1. Split text into lines; pre-process flagged split-line values.
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
  const rawLines = text.split(/\r?\n/);

  // Pre-process: combine "* NUMBER" lines with the following line when together
  // they form a recognisable VALUE_UNIT token.
  // Synlab French reports emit flagged values split across two lines:
  //   "* 25.9"   ← value with flag prefix
  //   "mg/L"     ← unit on the next line
  // Merging them into "25.9mg/L" lets VALUE_UNIT_RE match normally.
  const lines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    const flagMatch = FLAGGED_NUM_RE.exec(trimmed);
    if (flagMatch && i + 1 < rawLines.length) {
      const combined = flagMatch[1] + rawLines[i + 1].trim();
      if (VALUE_UNIT_RE.test(combined)) {
        lines.push(combined);
        i++; // skip the unit-only line — it has been consumed
        continue;
      }
    }
    lines.push(rawLines[i]);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = VALUE_UNIT_RE.exec(line);
    if (!match) continue;

    const rawValue = match[1];
    const unit = match[2];
    const value = parseEuropeanFloat(rawValue);
    if (Number.isNaN(value)) continue;

    // --- Inline test name: text before the value+unit token on the same line ---
    // Synlab French PDFs (and some other formats) place the test name and the
    // value+unit on the same logical line because both items share the same
    // Y coordinate in the PDF, causing pdfjs to concatenate them with no space:
    //   "HEMATIES5.33T/L"  →  prefix "HEMATIES" is the test name
    const prefixText = line.slice(0, match.index).trim();
    let inlineTestName: string | undefined;
    if (
      prefixText.length >= 2 &&
      prefixText.length <= 80 &&
      !NOISE_RE.test(prefixText) &&
      !VALUE_UNIT_RE.test(prefixText) &&
      // Reject lines that contain < or > — those are therapeutic-target table rows
      // (e.g. "très élevé <" from "très élevé < 0.55 g/l"), not test names
      !/[<>]/.test(prefixText) &&
      /[A-Za-zÀ-ÖØ-öø-ÿ].*[A-Za-zÀ-ÖØ-öø-ÿ]/s.test(prefixText)
    ) {
      inlineTestName = prefixText.replace(/\s*[*#]\s*$/, "").trim();
    }

    // --- Inline ref range: text after the value+unit token on the same line ---
    // Some formats write value+unit immediately followed by the range:
    //   "92.8μmol/L(64.5 à 104.3)"
    const lineSuffix = line.slice(match.index + match[0].length).trim();
    const inlineRefRange = REF_RANGE_RE.test(lineSuffix)
      ? lineSuffix.replace(/[()]/g, "").trim()
      : undefined;

    // --- Find reference range in the forward window (lines after the value) ---
    // In French lab PDFs (and most other formats) the reference range always
    // appears immediately after the value line — never before it. Searching
    // backwards would risk picking up the previous test's reference range.
    // We stop the search as soon as we cross another value+unit line.
    let referenceRange: string | undefined = inlineRefRange;
    if (!referenceRange) {
      for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
        const candidate = lines[j].trim();
        // Stop if we've crossed into the next result's value line
        if (VALUE_UNIT_RE.test(candidate)) break;
        if (REF_RANGE_RE.test(candidate)) {
          referenceRange = candidate.replace(/[()]/g, "").trim();
          break;
        }
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
    // If an inline name was already found in the prefix, skip this search.
    let testName: string | undefined = inlineTestName;
    if (!testName) {
      const nameWindow = [i + 1, i + 2, i + 3, i - 1, i - 2, i - 3];
      for (const j of nameWindow) {
        if (j < 0 || j >= lines.length) continue;
        const candidate = lines[j].trim();

        // Skip if it's a ref range, a value+unit line, a bare number, or noise
        if (REF_RANGE_RE.test(candidate)) continue;
        if (VALUE_UNIT_RE.test(candidate)) continue;
        if (/^\d+[.,]?\d*$/.test(candidate)) continue;
        if (NOISE_RE.test(candidate)) continue;
        // Reject lines containing angle brackets (therapeutic-target table rows
        // such as "très élevé < 0.55 g/l" or annotation lines like "< LDL")
        if (/[<>]/.test(candidate)) continue;
        // Must contain at least 2 letters (not necessarily consecutive — covers
        // dotted abbreviations like "V.G.M." and "T.C.M.H.")
        if (!/[A-Za-zÀ-ÖØ-öø-ÿ].*[A-Za-zÀ-ÖØ-öø-ÿ]/s.test(candidate)) continue;
        // Reasonable length
        if (candidate.length < 2 || candidate.length > 80) continue;

        testName = candidate;
        break;
      }
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

  // Two-sided range: "4,60 - 6,20" or "4.60 - 6.20" or "79 - 97" or "4.5 à 5.7" (French)
  const twoSided = referenceRange.match(new RegExp(`${NUM}\\s*(?:[-–]|à)\\s*${NUM}`));
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
 * Update the date for a lab result (user correction or initial edit).
 */
export async function updateLabDate(id: string, date: string): Promise<void> {
  await db.labResults.update(id, { date });
}

/**
 * Update notes for a lab result.
 */
export async function updateLabNotes(id: string, notes: string): Promise<void> {
  await db.labResults.update(id, { notes });
}

/**
 * Update structured values (and optionally the raw extracted text) for a lab result.
 * Used by the re-extract flow in the detail view to refresh results that were saved
 * before the extraction logic was working correctly.
 */
export async function updateLabStructuredValues(
  id: string,
  structuredValues: Record<string, StructuredValue>,
  extractedText?: string,
): Promise<void> {
  if (extractedText !== undefined) {
    await db.labResults.update(id, { structuredValues, extractedText });
  } else {
    await db.labResults.update(id, { structuredValues });
  }
}

/**
 * Get a PDF blob URL for viewing.
 */
export function createPdfUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
