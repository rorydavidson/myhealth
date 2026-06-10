/**
 * Tests for the aggregation service — computeDailySummaries and recomputeAllSummaries.
 *
 * Uses a small in-memory fake for the Dexie tables so no real browser storage is
 * required. The fake supports the two query shapes the service uses:
 *   - healthRecords.where("importId").equals(id).toArray()
 *   - healthRecords.where("[metricType+startTime]").between([mt,lo],[mt,hi]).toArray()
 * plus imports.toArray() (for source priority) and dailySummaries bulkPut/clear.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthRecordRow } from "@/db";

const state = vi.hoisted(() => ({
  records: [] as HealthRecordRow[],
  imports: [] as { platform: string; startedAt: Date }[],
}));

const mockDb = vi.hoisted(() => ({
  healthRecords: {
    where: (index: string) => {
      if (index === "importId") {
        return {
          equals: (val: string) => ({
            toArray: async () => state.records.filter((r) => r.importId === val),
          }),
        };
      }
      // "[metricType+startTime]"
      return {
        between: (lo: [string, Date], hi: [string, Date]) => ({
          toArray: async () => {
            const [mt, loDate] = lo;
            const [, hiDate] = hi;
            return state.records.filter(
              (r) => r.metricType === mt && r.startTime >= loDate && r.startTime <= hiDate,
            );
          },
        }),
      };
    },
    toArray: async () => state.records,
  },
  imports: {
    toArray: async () => state.imports,
  },
  dailySummaries: {
    bulkPut: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
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

/** Last summaries array passed to bulkPut. */
function lastSummaries(): Array<{
  id: string;
  metricType: string;
  date: string;
  avg: number | null;
  min: number | null;
  max: number | null;
  sum: number | null;
  count: number;
}> {
  const calls = mockDb.dailySummaries.bulkPut.mock.calls;
  return calls[calls.length - 1]?.[0] ?? [];
}

beforeEach(() => {
  state.records = [];
  state.imports = [];
  mockDb.dailySummaries.bulkPut.mockClear();
  mockDb.dailySummaries.clear.mockClear();
});

// --- computeDailySummaries ---

describe("computeDailySummaries", () => {
  it("returns 0 when there are no records for the import", async () => {
    const result = await computeDailySummaries("import-1");
    expect(result).toBe(0);
    expect(mockDb.dailySummaries.bulkPut).not.toHaveBeenCalled();
  });

  it("creates a daily summary from the import's records", async () => {
    state.records = [
      makeRecord({ value: 1000, startTime: new Date("2024-03-15T08:00:00Z") }),
      makeRecord({ value: 2000, startTime: new Date("2024-03-15T12:00:00Z") }),
    ];

    const result = await computeDailySummaries("import-1");

    expect(result).toBe(1);
    expect(lastSummaries()[0]).toMatchObject({
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

  it("recomputes the affected bucket from current records (overwrite, not merge)", async () => {
    // Two records already in the DB for the same metric+day from the same import.
    state.records = [
      makeRecord({ value: 1000, startTime: new Date("2024-03-15T08:00:00Z") }),
      makeRecord({ value: 500, startTime: new Date("2024-03-15T18:00:00Z") }),
    ];

    await computeDailySummaries("import-1");

    const s = lastSummaries()[0];
    // Recomputed from scratch — exactly the two records, never added onto a
    // pre-existing summary.
    expect(s.count).toBe(2);
    expect(s.sum).toBe(1500);
    expect(s.min).toBe(500);
    expect(s.max).toBe(1000);
  });

  it("keeps only the first-imported source when sources overlap on a metric+day", async () => {
    // Apple imported first, Whoop later → Apple wins the day.
    state.imports = [
      { platform: "apple_health", startedAt: new Date("2024-01-01T00:00:00Z") },
      { platform: "whoop", startedAt: new Date("2024-02-01T00:00:00Z") },
    ];
    state.records = [
      makeRecord({
        metricType: "sleep_session",
        value: 8,
        startTime: new Date("2024-03-15T23:00:00Z"),
        sourcePlatform: "apple_health",
        importId: "apple-1",
      }),
      makeRecord({
        metricType: "sleep_session",
        value: 7,
        startTime: new Date("2024-03-15T23:05:00Z"),
        sourcePlatform: "whoop",
        importId: "whoop-1",
      }),
    ];

    // Importing Whoop (the later source) must NOT add a second sleep value.
    await computeDailySummaries("whoop-1");

    const s = lastSummaries().find((x) => x.id === "sleep_session:2024-03-15");
    expect(s?.count).toBe(1); // only the Apple record survives
    expect(s?.sum).toBe(8); // Apple's value, not 8 + 7 = 15
  });

  it("creates one summary per distinct metricType+date combination", async () => {
    state.records = [
      makeRecord({
        metricType: "step_count",
        value: 3000,
        startTime: new Date("2024-03-15T08:00:00Z"),
      }),
      makeRecord({
        metricType: "heart_rate",
        value: 72,
        startTime: new Date("2024-03-15T09:00:00Z"),
      }),
      makeRecord({
        metricType: "step_count",
        value: 2000,
        startTime: new Date("2024-03-16T08:00:00Z"),
      }),
    ];

    const result = await computeDailySummaries("import-1");
    expect(result).toBe(3);
  });

  it("rounds values to 2 decimal places", async () => {
    state.records = [
      makeRecord({
        metricType: "body_mass",
        value: 75.3333,
        startTime: new Date("2024-03-15T08:00:00Z"),
      }),
      makeRecord({
        metricType: "body_mass",
        value: 75.6666,
        startTime: new Date("2024-03-15T12:00:00Z"),
      }),
    ];

    await computeDailySummaries("import-1");
    expect(lastSummaries()[0].avg).toBeCloseTo(75.5, 1);
  });

  it("skips records with null values", async () => {
    state.records = [makeRecord({ value: null })];
    const result = await computeDailySummaries("import-1");
    expect(result).toBe(0);
    expect(mockDb.dailySummaries.bulkPut).not.toHaveBeenCalled();
  });

  it("does not call bulkPut when all records are null-valued", async () => {
    state.records = [makeRecord({ value: null }), makeRecord({ value: null })];
    await computeDailySummaries("import-1");
    expect(mockDb.dailySummaries.bulkPut).not.toHaveBeenCalled();
  });
});

// --- recomputeAllSummaries ---

describe("recomputeAllSummaries", () => {
  it("clears existing summaries before recomputing", async () => {
    await recomputeAllSummaries();
    expect(mockDb.dailySummaries.clear).toHaveBeenCalledOnce();
  });

  it("returns 0 when there are no health records", async () => {
    const result = await recomputeAllSummaries();
    expect(result).toBe(0);
    expect(mockDb.dailySummaries.bulkPut).not.toHaveBeenCalled();
  });

  it("recomputes summaries and returns the number of groups created", async () => {
    state.records = [
      makeRecord({
        metricType: "step_count",
        value: 5000,
        startTime: new Date("2024-03-15T10:00:00Z"),
      }),
      makeRecord({
        metricType: "step_count",
        value: 3000,
        startTime: new Date("2024-03-15T18:00:00Z"),
      }),
      makeRecord({
        metricType: "heart_rate",
        value: 72,
        startTime: new Date("2024-03-15T09:00:00Z"),
      }),
    ];

    const result = await recomputeAllSummaries();

    expect(result).toBe(2);
    const stepSummary = lastSummaries().find((s) => s.id === "step_count:2024-03-15");
    expect(stepSummary?.sum).toBe(8000);
    expect(stepSummary?.count).toBe(2);
    expect(stepSummary?.avg).toBe(4000);
  });

  it("deduplicates across sources, keeping the first-imported source", async () => {
    state.imports = [
      { platform: "whoop", startedAt: new Date("2024-01-01T00:00:00Z") }, // imported first
      { platform: "apple_health", startedAt: new Date("2024-03-01T00:00:00Z") },
    ];
    state.records = [
      makeRecord({
        metricType: "sleep_session",
        value: 7.5,
        startTime: new Date("2024-03-15T23:00:00Z"),
        sourcePlatform: "whoop",
        importId: "whoop-1",
      }),
      makeRecord({
        metricType: "sleep_session",
        value: 8.2,
        startTime: new Date("2024-03-15T23:10:00Z"),
        sourcePlatform: "apple_health",
        importId: "apple-1",
      }),
    ];

    await recomputeAllSummaries();

    const s = lastSummaries().find((x) => x.id === "sleep_session:2024-03-15");
    expect(s?.count).toBe(1);
    expect(s?.sum).toBe(7.5); // Whoop was imported first
  });

  it("keeps non-overlapping days from a later source", async () => {
    state.imports = [
      { platform: "apple_health", startedAt: new Date("2024-01-01T00:00:00Z") },
      { platform: "whoop", startedAt: new Date("2024-02-01T00:00:00Z") },
    ];
    state.records = [
      // Apple sleep on the 15th, Whoop sleep on the 16th — different days, both kept.
      makeRecord({
        metricType: "sleep_session",
        value: 8,
        startTime: new Date("2024-03-15T23:00:00Z"),
        sourcePlatform: "apple_health",
        importId: "apple-1",
      }),
      makeRecord({
        metricType: "sleep_session",
        value: 7,
        startTime: new Date("2024-03-16T23:00:00Z"),
        sourcePlatform: "whoop",
        importId: "whoop-1",
      }),
    ];

    const result = await recomputeAllSummaries();
    expect(result).toBe(2);
    expect(lastSummaries().find((x) => x.id === "sleep_session:2024-03-15")?.sum).toBe(8);
    expect(lastSummaries().find((x) => x.id === "sleep_session:2024-03-16")?.sum).toBe(7);
  });

  it("skips null-value records during recompute", async () => {
    state.records = [makeRecord({ value: null }), makeRecord({ value: 1000 })];
    const result = await recomputeAllSummaries();
    expect(result).toBe(1);
    expect(lastSummaries()[0].count).toBe(1);
  });

  it("computes correct stats (min, max, avg, sum) during recompute", async () => {
    state.records = [
      makeRecord({
        metricType: "heart_rate",
        value: 60,
        startTime: new Date("2024-03-15T08:00:00Z"),
      }),
      makeRecord({
        metricType: "heart_rate",
        value: 80,
        startTime: new Date("2024-03-15T12:00:00Z"),
      }),
      makeRecord({
        metricType: "heart_rate",
        value: 70,
        startTime: new Date("2024-03-15T16:00:00Z"),
      }),
    ];

    await recomputeAllSummaries();

    expect(lastSummaries()[0]).toMatchObject({
      min: 60,
      max: 80,
      sum: 210,
      avg: 70,
      count: 3,
    });
  });
});
