/**
 * React hooks for querying health data from local IndexedDB.
 *
 * All data stays local — these hooks use Dexie's live queries
 * so the UI updates reactively when data changes.
 */

import type { MetricType } from "@health-app/shared";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { type DailySummaryRow, db, type HealthRecordRow } from "@/db";

// --- Date range utilities ---

export type DateRangePreset = "7d" | "30d" | "90d" | "1y" | "all";

export function getDateRange(preset: DateRangePreset): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (preset) {
    case "7d":
      start.setDate(start.getDate() - 6);
      break;
    case "30d":
      start.setDate(start.getDate() - 29);
      break;
    case "90d":
      start.setDate(start.getDate() - 89);
      break;
    case "1y":
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "all":
      start.setFullYear(2000);
      break;
  }

  return { start, end };
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// --- Daily summary hooks ---

/**
 * Get daily summaries for a metric type within a date range.
 * Returns data sorted by date ascending.
 */
export function useDailySummaries(
  metricType: MetricType,
  preset: DateRangePreset,
): { data: DailySummaryRow[]; isLoading: boolean } {
  const { start, end } = useMemo(() => getDateRange(preset), [preset]);
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);

  const data = useLiveQuery(
    () =>
      db.dailySummaries
        .where("[metricType+date]")
        .between([metricType, startKey], [metricType, endKey], true, true)
        .sortBy("date"),
    [metricType, startKey, endKey],
  );

  return {
    data: data ?? [],
    isLoading: data === undefined,
  };
}

/**
 * Get the latest daily summary for a metric (most recent date with data).
 */
export function useLatestSummary(metricType: MetricType): {
  data: DailySummaryRow | undefined;
  isLoading: boolean;
} {
  const data = useLiveQuery(
    () =>
      db.dailySummaries
        .where("[metricType+date]")
        .between([metricType, "0000-00-00"], [metricType, "9999-99-99"])
        .last(),
    [metricType],
  );

  return {
    data: data ?? undefined,
    isLoading: data === undefined,
  };
}

/**
 * Get today's summary for a metric.
 */
export function useTodaySummary(metricType: MetricType): {
  data: DailySummaryRow | undefined;
  isLoading: boolean;
} {
  const todayKey = toDateKey(new Date());

  const data = useLiveQuery(
    () => db.dailySummaries.get(`${metricType}:${todayKey}`),
    [metricType, todayKey],
  );

  return {
    data: data ?? undefined,
    isLoading: data === undefined,
  };
}

/**
 * Get snapshot summaries for all dashboard metric types.
 * Returns the most recent day's data for each metric.
 */
export function useDashboardSnapshot(): {
  data: Map<MetricType, DailySummaryRow>;
  isLoading: boolean;
} {
  const todayKey = toDateKey(new Date());
  const yesterdayKey = toDateKey(new Date(Date.now() - 86400000));

  const result = useLiveQuery(async () => {
    const metrics: MetricType[] = [
      "step_count",
      "distance",
      "active_energy",
      "heart_rate",
      "resting_heart_rate",
      "body_mass",
      "sleep_session",
      "oxygen_saturation",
    ];

    const map = new Map<MetricType, DailySummaryRow>();

    for (const metric of metrics) {
      // Try today first, then yesterday
      let summary = await db.dailySummaries.get(`${metric}:${todayKey}`);
      if (!summary) {
        summary = await db.dailySummaries.get(`${metric}:${yesterdayKey}`);
      }
      // If no recent data, get latest available
      if (!summary) {
        summary = await db.dailySummaries
          .where("[metricType+date]")
          .between([metric, "0000-00-00"], [metric, "9999-99-99"])
          .last();
      }
      if (summary) {
        map.set(metric as MetricType, summary);
      }
    }

    return map;
  }, [todayKey]);

  return {
    data: result ?? new Map(),
    isLoading: result === undefined,
  };
}

/**
 * Get the average value for a metric over the last N days.
 * Used for "vs. average" comparisons.
 */
export function useMetricAverage(
  metricType: MetricType,
  days: number,
): { avg: number | null; isLoading: boolean } {
  const end = toDateKey(new Date());
  const start = toDateKey(new Date(Date.now() - days * 86400000));

  const result = useLiveQuery(async () => {
    const summaries = await db.dailySummaries
      .where("[metricType+date]")
      .between([metricType, start], [metricType, end], true, true)
      .toArray();

    if (summaries.length === 0) return null;

    const values = summaries.map((s) => s.sum ?? s.avg).filter((v): v is number => v !== null);

    if (values.length === 0) return null;

    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [metricType, start, end]);

  return {
    avg: result ?? null,
    isLoading: result === undefined,
  };
}

/**
 * Check if any health data exists at all.
 */
export function useHasHealthData(): { hasData: boolean; isLoading: boolean } {
  const count = useLiveQuery(() => db.healthRecords.count(), []);

  return {
    hasData: (count ?? 0) > 0,
    isLoading: count === undefined,
  };
}

/**
 * Get raw health records for a metric within a date range.
 * Use sparingly — prefer dailySummaries for dashboard display.
 */
export function useHealthRecords(
  metricType: MetricType,
  preset: DateRangePreset,
): { data: HealthRecordRow[]; isLoading: boolean } {
  const { start, end } = useMemo(() => getDateRange(preset), [preset]);

  const data = useLiveQuery(
    () =>
      db.healthRecords
        .where("[metricType+startTime]")
        .between([metricType, start], [metricType, end], true, true)
        .sortBy("startTime"),
    [metricType, start.toISOString(), end.toISOString()],
  );

  return {
    data: data ?? [],
    isLoading: data === undefined,
  };
}
