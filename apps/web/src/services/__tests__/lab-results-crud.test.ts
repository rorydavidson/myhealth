/**
 * Tests for lab-results CRUD operations and createPdfUrl helper.
 * Uses a mocked IndexedDB so no real browser storage is required.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// --- DB Mock ---
const mockDb = vi.hoisted(() => ({
  labResults: {
    put: vi.fn(),
    orderBy: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/db", () => ({ db: mockDb }));

import {
  saveLabResult,
  getLabResults,
  deleteLabResult,
  updateLabNotes,
  createPdfUrl,
} from "../lab-results";

// --- saveLabResult ---

describe("saveLabResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.labResults.put.mockResolvedValue(undefined);
  });

  it("returns a UUID string", async () => {
    const file = new File(["pdf content"], "blood-test.pdf", { type: "application/pdf" });

    const id = await saveLabResult({
      file,
      date: "2024-03-15",
      category: "blood_panel",
      extractedText: "Hemoglobin 14.2 g/dL",
      structuredValues: {},
    });

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("calls db.labResults.put with correct fields", async () => {
    const file = new File(["content"], "lipids.pdf", { type: "application/pdf" });
    const structuredValues = {
      HDL: { value: 55, unit: "mg/dL", flag: "normal" },
    };

    await saveLabResult({
      file,
      date: "2024-03-15",
      category: "lipid_panel",
      notes: "Fasting sample",
      extractedText: "HDL 55 mg/dL",
      structuredValues,
    });

    expect(mockDb.labResults.put).toHaveBeenCalledOnce();
    const [row] = mockDb.labResults.put.mock.calls[0];
    expect(row.date).toBe("2024-03-15");
    expect(row.category).toBe("lipid_panel");
    expect(row.notes).toBe("Fasting sample");
    expect(row.extractedText).toBe("HDL 55 mg/dL");
    expect(row.structuredValues).toEqual(structuredValues);
    expect(row.fileName).toBe("lipids.pdf");
  });

  it("defaults notes to an empty string when not provided", async () => {
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });

    await saveLabResult({
      file,
      date: "2024-03-15",
      category: "other",
      extractedText: "",
      structuredValues: {},
    });

    const [row] = mockDb.labResults.put.mock.calls[0];
    expect(row.notes).toBe("");
  });

  it("stores a Blob derived from the file content", async () => {
    const file = new File(["pdf bytes"], "report.pdf", { type: "application/pdf" });

    await saveLabResult({
      file,
      date: "2024-03-15",
      category: "other",
      extractedText: "",
      structuredValues: {},
    });

    const [row] = mockDb.labResults.put.mock.calls[0];
    expect(row.pdfBlob).toBeInstanceOf(Blob);
  });
});

// --- getLabResults ---

describe("getLabResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all lab results ordered by date descending", async () => {
    const mockResults = [
      { id: "1", date: "2024-03-15", category: "blood_panel" },
      { id: "2", date: "2024-02-01", category: "thyroid" },
    ];

    mockDb.labResults.orderBy.mockReturnValue({
      reverse: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(mockResults) }),
    });

    const results = await getLabResults();
    expect(results).toEqual(mockResults);
    expect(mockDb.labResults.orderBy).toHaveBeenCalledWith("date");
  });

  it("returns an empty array when there are no results", async () => {
    mockDb.labResults.orderBy.mockReturnValue({
      reverse: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
    });

    const results = await getLabResults();
    expect(results).toEqual([]);
  });
});

// --- deleteLabResult ---

describe("deleteLabResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.labResults.delete.mockResolvedValue(undefined);
  });

  it("calls db.labResults.delete with the given id", async () => {
    await deleteLabResult("abc-123");
    expect(mockDb.labResults.delete).toHaveBeenCalledWith("abc-123");
  });
});

// --- updateLabNotes ---

describe("updateLabNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.labResults.update.mockResolvedValue(1);
  });

  it("calls db.labResults.update with id and notes object", async () => {
    await updateLabNotes("abc-123", "Fasting, 12-hour fast");
    expect(mockDb.labResults.update).toHaveBeenCalledWith("abc-123", {
      notes: "Fasting, 12-hour fast",
    });
  });
});

// --- createPdfUrl ---

describe("createPdfUrl", () => {
  it("delegates to URL.createObjectURL and returns a blob URL", () => {
    const blob = new Blob(["data"], { type: "application/pdf" });
    const mockUrl = "blob:http://localhost/fake-uuid";
    const spy = vi.spyOn(URL, "createObjectURL").mockReturnValue(mockUrl);

    const result = createPdfUrl(blob);

    expect(result).toBe(mockUrl);
    expect(spy).toHaveBeenCalledWith(blob);

    spy.mockRestore();
  });
});
