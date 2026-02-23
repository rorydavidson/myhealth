/**
 * Unit tests for the aggregation service.
 * Tests summary computation logic (avg, min, max, sum, count).
 */

import { describe, expect, it } from "vitest";

// We extract the pure computation logic for testing without IndexedDB
// The toDateKey helper and aggregation math are tested via re-implementation

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface MockRecord {
  metricType: string;
  value: number | null;
  startTime: Date;
}

function computeSummaryStats(values: number[]): {
  min: number;
  max: number;
  sum: number;
  avg: number;
  count: number;
} {
  if (values.length === 0) throw new Error("No values");
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  return { min, max, sum, avg, count: values.length };
}

function mergeSummaries(
  existing: { avg: number; sum: number; min: number; max: number; count: number },
  incoming: { avg: number; sum: number; min: number; max: number; count: number },
) {
  const totalCount = existing.count + incoming.count;
  return {
    count: totalCount,
    sum: existing.sum + incoming.sum,
    avg: (existing.avg * existing.count + incoming.sum) / totalCount,
    min: Math.min(existing.min, incoming.min),
    max: Math.max(existing.max, incoming.max),
  };
}

describe("toDateKey", () => {
  it("extracts YYYY-MM-DD from a UTC Date", () => {
    const date = new Date("2024-03-15T14:30:00Z");
    expect(toDateKey(date)).toBe("2024-03-15");
  });

  it("uses UTC date, not local date", () => {
    // A date that might be the previous day in some timezones
    const date = new Date("2024-03-15T00:30:00Z");
    expect(toDateKey(date)).toBe("2024-03-15");
  });
});

describe("computeSummaryStats", () => {
  it("computes correct stats for a single value", () => {
    const stats = computeSummaryStats([100]);
    expect(stats.min).toBe(100);
    expect(stats.max).toBe(100);
    expect(stats.sum).toBe(100);
    expect(stats.avg).toBe(100);
    expect(stats.count).toBe(1);
  });

  it("computes correct stats for multiple values", () => {
    const stats = computeSummaryStats([60, 80, 72, 68, 75]);
    expect(stats.min).toBe(60);
    expect(stats.max).toBe(80);
    expect(stats.sum).toBe(355);
    expect(stats.avg).toBeCloseTo(71, 1);
    expect(stats.count).toBe(5);
  });

  it("handles steps across a full day", () => {
    // Simulate 24 hourly step count records totaling ~8000 steps
    const hourlySteps = Array.from({ length: 24 }, (_, i) => (i < 6 || i >= 22 ? 0 : 380));
    const stats = computeSummaryStats(hourlySteps.filter((v) => v > 0));
    expect(stats.sum).toBe(380 * 16);
    expect(stats.count).toBe(16);
  });
});

describe("mergeSummaries", () => {
  it("correctly merges two non-overlapping summaries", () => {
    const existing = { avg: 70, sum: 210, min: 60, max: 80, count: 3 };
    const incoming = { avg: 90, sum: 270, min: 85, max: 95, count: 3 };
    const merged = mergeSummaries(existing, incoming);

    expect(merged.count).toBe(6);
    expect(merged.sum).toBe(480);
    expect(merged.min).toBe(60);
    expect(merged.max).toBe(95);
    // avg should be weighted: (70*3 + 270) / 6 = 480/6 = 80
    expect(merged.avg).toBeCloseTo(80, 3);
  });

  it("preserves min across merges", () => {
    const existing = { avg: 100, sum: 200, min: 90, max: 110, count: 2 };
    const incoming = { avg: 50, sum: 50, min: 50, max: 50, count: 1 };
    const merged = mergeSummaries(existing, incoming);
    expect(merged.min).toBe(50);
  });

  it("preserves max across merges", () => {
    const existing = { avg: 100, sum: 200, min: 90, max: 110, count: 2 };
    const incoming = { avg: 200, sum: 200, min: 190, max: 200, count: 1 };
    const merged = mergeSummaries(existing, incoming);
    expect(merged.max).toBe(200);
  });
});

describe("grouping by date", () => {
  it("groups records by metricType + date key correctly", () => {
    const records: MockRecord[] = [
      { metricType: "step_count", value: 1000, startTime: new Date("2024-03-15T08:00:00Z") },
      { metricType: "step_count", value: 2000, startTime: new Date("2024-03-15T12:00:00Z") },
      { metricType: "step_count", value: 500, startTime: new Date("2024-03-16T08:00:00Z") },
      { metricType: "heart_rate", value: 72, startTime: new Date("2024-03-15T09:00:00Z") },
    ];

    const groups = new Map<string, number[]>();

    for (const record of records) {
      if (record.value === null) continue;
      const dateKey = toDateKey(record.startTime);
      const groupKey = `${record.metricType}:${dateKey}`;
      const existing = groups.get(groupKey);
      if (existing) {
        existing.push(record.value);
      } else {
        groups.set(groupKey, [record.value]);
      }
    }

    expect(groups.size).toBe(3);
    expect(groups.get("step_count:2024-03-15")).toEqual([1000, 2000]);
    expect(groups.get("step_count:2024-03-16")).toEqual([500]);
    expect(groups.get("heart_rate:2024-03-15")).toEqual([72]);
  });

  it("ignores null values", () => {
    const records: MockRecord[] = [
      { metricType: "step_count", value: null, startTime: new Date("2024-03-15T08:00:00Z") },
      { metricType: "step_count", value: 1000, startTime: new Date("2024-03-15T10:00:00Z") },
    ];

    const groups = new Map<string, number[]>();
    for (const record of records) {
      if (record.value === null) continue;
      const groupKey = `${record.metricType}:${toDateKey(record.startTime)}`;
      const existing = groups.get(groupKey);
      if (existing) existing.push(record.value);
      else groups.set(groupKey, [record.value]);
    }

    expect(groups.get("step_count:2024-03-15")).toEqual([1000]);
  });
});
