/**
 * Tests for the aggregation service — computeDailySummaries and recomputeAllSummaries.
 * Uses a mocked IndexedDB (Dexie) so no real browser storage is required.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { HealthRecordRow } from "@/db";

// vi.hoisted runs before vi.mock hoisting, making these available inside the factory
const mockDb = vi.hoisted(() => ({
  healthRecords: {
    where: vi.fn(),
    toArray: vi.fn(),
  },
  dailySummaries: {
    get: vi.fn(),
    bulkPut: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock("@/db", () => ({ db: mockDb }));

import { computeDailySummaries, recomputeAllSummaries } from "../aggregate";

// --- Helpers ---

function makeRecord(overrides: Partial<HealthRecordRow> = {}): HealthRecordRow {
  return {
    id: crypto.randomUUID(),
    metricType: "step_count",
    value: 1000,
    unit: "count",
    startTime: new Date("2024-03-15T08:00:00Z"),
    endTime: new Date("2024-03-15T08:00:00Z"),
    sourcePlatform: "apple_health",
    sourceDevice: "iPhone",
    sourceType: "HKQuantityTypeIdentifierStepCount",
    importId: "import-1",
    ...overrides,
  };
}

// --- computeDailySummaries ---

describe("computeDailySummaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when there are no records for the import", async () => {
    mockDb.healthRecords.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
    });

    const result = await computeDailySummaries("import-1");

    expect(result).toBe(0);
    expect(mockDb.dailySummaries.bulkPut).not.toHaveBeenCalled();
  });

  it("creates a new daily summary when none exists", async () => {
    const records = [
      makeRecord({ value: 1000, startTime: new Date("2024-03-15T08:00:00Z") }),
      makeRecord({ value: 2000, startTime: new Date("2024-03-15T12:00:00Z") }),
    ];

    mockDb.healthRecords.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(records) }),
    });
    mockDb.dailySummaries.get.mockResolvedValue(null);
    mockDb.dailySummaries.bulkPut.mockResolvedValue(undefined);

    const result = await computeDailySummaries("import-1");

    expect(result).toBe(1);
    const [summaries] = mockDb.dailySummaries.bulkPut.mock.calls[0];
    expect(summaries[0]).toMatchObject({
      id: "step_count:2024-03-15",
      metricType: "step_count",
      date: "2024-03-15",
      min: 1000,
      max: 2000,
      sum: 3000,
      avg: 1500,
      count: 2,
    });
  });

  it("merges incoming records with an existing summary", async () => {
    const records = [makeRecord({ value: 500, startTime: new Date("2024-03-15T18:00:00Z") })];

    mockDb.healthRecords.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(records) }),
    });

    const existingSummary = {
      id: "step_count:2024-03-15",
      metricType: "step_count",
      date: "2024-03-15",
      avg: 600,
      min: 200,
      max: 1000,
      sum: 1800,
      count: 3,
    };
    mockDb.dailySummaries.get.mockResolvedValue(existingSummary);
    mockDb.dailySummaries.bulkPut.mockResolvedValue(undefined);

    await computeDailySummaries("import-1");

    const [summaries] = mockDb.dailySummaries.bulkPut.mock.calls[0];
    const merged = summaries[0];
    expect(merged.count).toBe(4); // 3 existing + 1 incoming
    expect(merged.sum).toBe(2300); // 1800 + 500
    expect(merged.min).toBe(200); // existing min preserved
    expect(merged.max).toBe(1000); // existing max preserved (500 < 1000)
  });

  it("updates max when incoming value exceeds existing max", async () => {
    const records = [makeRecord({ value: 1500, startTime: new Date("2024-03-15T18:00:00Z") })];

    mockDb.healthRecords.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(records) }),
    });

    const existingSummary = {
      id: "step_count:2024-03-15",
      metricType: "step_count",
      date: "2024-03-15",
      avg: 800,
      min: 500,
      max: 1000,
      sum: 800,
      count: 1,
    };
    mockDb.dailySummaries.get.mockResolvedValue(existingSummary);
    mockDb.dailySummaries.bulkPut.mockResolvedValue(undefined);

    await computeDailySummaries("import-1");

    const [summaries] = mockDb.dailySummaries.bulkPut.mock.calls[0];
    expect(summaries[0].max).toBe(1500);
  });

  it("skips records with null values", async () => {
    const records = [makeRecord({ value: null })];

    mockDb.healthRecords.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(records) }),
    });

    const result = await computeDailySummaries("import-1");

    expect(result).toBe(0);
    expect(mockDb.dailySummaries.bulkPut).not.toHaveBeenCalled();
  });

  it("creates one summary per distinct metricType+date combination", async () => {
    const records = [
      makeRecord({ metricType: "step_count", value: 3000, startTime: new Date("2024-03-15T08:00:00Z") }),
      makeRecord({ metricType: "heart_rate", value: 72, startTime: new Date("2024-03-15T09:00:00Z") }),
      makeRecord({ metricType: "step_count", value: 2000, startTime: new Date("2024-03-16T08:00:00Z") }),
    ];

    mockDb.healthRecords.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(records) }),
    });
    mockDb.dailySummaries.get.mockResolvedValue(null);
    mockDb.dailySummaries.bulkPut.mockResolvedValue(undefined);

    const result = await computeDailySummaries("import-1");

    expect(result).toBe(3);
  });

  it("rounds values to 2 decimal places", async () => {
    const records = [
      makeRecord({ metricType: "body_mass", value: 75.3333, startTime: new Date("2024-03-15T08:00:00Z") }),
      makeRecord({ metricType: "body_mass", value: 75.6666, startTime: new Date("2024-03-15T12:00:00Z") }),
    ];

    mockDb.healthRecords.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(records) }),
    });
    mockDb.dailySummaries.get.mockResolvedValue(null);
    mockDb.dailySummaries.bulkPut.mockResolvedValue(undefined);

    await computeDailySummaries("import-1");

    const [summaries] = mockDb.dailySummaries.bulkPut.mock.calls[0];
    expect(summaries[0].avg).toBeCloseTo(75.5, 1);
  });

  it("handles null avg/min/max/sum in an existing summary during merge", async () => {
    // DailySummaryRow fields are nullable; the merge should use ?? fallbacks safely
    const records = [makeRecord({ value: 800, startTime: new Date("2024-03-15T18:00:00Z") })];

    mockDb.healthRecords.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(records) }),
    });

    const existingSummaryWithNulls = {
      id: "step_count:2024-03-15",
      metricType: "step_count",
      date: "2024-03-15",
      avg: null,
      min: null,
      max: null,
      sum: null,
      count: 0,
    };
    mockDb.dailySummaries.get.mockResolvedValue(existingSummaryWithNulls);
    mockDb.dailySummaries.bulkPut.mockResolvedValue(undefined);

    await computeDailySummaries("import-1");

    const [summaries] = mockDb.dailySummaries.bulkPut.mock.calls[0];
    const merged = summaries[0];
    expect(merged.count).toBe(1);
    expect(merged.sum).toBe(800);
    expect(merged.min).toBe(800);
    expect(merged.max).toBe(800);
  });

  it("does not call bulkPut when all records are null-valued", async () => {
    const records = [makeRecord({ value: null }), makeRecord({ value: null })];

    mockDb.healthRecords.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(records) }),
    });

    await computeDailySummaries("import-1");

    expect(mockDb.dailySummaries.bulkPut).not.toHaveBeenCalled();
  });
});

// --- recomputeAllSummaries ---

describe("recomputeAllSummaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears existing summaries before recomputing", async () => {
    mockDb.dailySummaries.clear.mockResolvedValue(undefined);
    mockDb.healthRecords.toArray.mockResolvedValue([]);

    await recomputeAllSummaries();

    expect(mockDb.dailySummaries.clear).toHaveBeenCalledOnce();
  });

  it("returns 0 when there are no health records", async () => {
    mockDb.dailySummaries.clear.mockResolvedValue(undefined);
    mockDb.healthRecords.toArray.mockResolvedValue([]);

    const result = await recomputeAllSummaries();

    expect(result).toBe(0);
    expect(mockDb.dailySummaries.bulkPut).not.toHaveBeenCalled();
  });

  it("recomputes summaries and returns the number of groups created", async () => {
    const records = [
      makeRecord({ metricType: "step_count", value: 5000, startTime: new Date("2024-03-15T10:00:00Z") }),
      makeRecord({ metricType: "step_count", value: 3000, startTime: new Date("2024-03-15T18:00:00Z") }),
      makeRecord({ metricType: "heart_rate", value: 72, startTime: new Date("2024-03-15T09:00:00Z") }),
    ];

    mockDb.dailySummaries.clear.mockResolvedValue(undefined);
    mockDb.healthRecords.toArray.mockResolvedValue(records);
    mockDb.dailySummaries.bulkPut.mockResolvedValue(undefined);

    const result = await recomputeAllSummaries();

    expect(result).toBe(2); // step_count:2024-03-15, heart_rate:2024-03-15
    const [summaries] = mockDb.dailySummaries.bulkPut.mock.calls[0];
    const stepSummary = summaries.find((s: { id: string }) => s.id === "step_count:2024-03-15");
    expect(stepSummary.sum).toBe(8000);
    expect(stepSummary.count).toBe(2);
    expect(stepSummary.avg).toBe(4000);
  });

  it("skips null-value records during recompute", async () => {
    const records = [makeRecord({ value: null }), makeRecord({ value: 1000 })];

    mockDb.dailySummaries.clear.mockResolvedValue(undefined);
    mockDb.healthRecords.toArray.mockResolvedValue(records);
    mockDb.dailySummaries.bulkPut.mockResolvedValue(undefined);

    const result = await recomputeAllSummaries();

    expect(result).toBe(1);
    const [summaries] = mockDb.dailySummaries.bulkPut.mock.calls[0];
    expect(summaries[0].count).toBe(1);
  });

  it("computes correct stats (min, max, avg, sum) during recompute", async () => {
    const records = [
      makeRecord({ metricType: "heart_rate", value: 60, startTime: new Date("2024-03-15T08:00:00Z") }),
      makeRecord({ metricType: "heart_rate", value: 80, startTime: new Date("2024-03-15T12:00:00Z") }),
      makeRecord({ metricType: "heart_rate", value: 70, startTime: new Date("2024-03-15T16:00:00Z") }),
    ];

    mockDb.dailySummaries.clear.mockResolvedValue(undefined);
    mockDb.healthRecords.toArray.mockResolvedValue(records);
    mockDb.dailySummaries.bulkPut.mockResolvedValue(undefined);

    await recomputeAllSummaries();

    const [summaries] = mockDb.dailySummaries.bulkPut.mock.calls[0];
    expect(summaries[0]).toMatchObject({
      min: 60,
      max: 80,
      sum: 210,
      avg: 70,
      count: 3,
    });
  });
});
