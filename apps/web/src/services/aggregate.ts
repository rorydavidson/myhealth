/**
 * Aggregation Service
 *
 * Computes daily summaries from health records stored in IndexedDB.
 * Runs after import to pre-compute dashboard data for fast rendering.
 *
 * For each metric type, generates a DailySummaryRow with:
 * - avg, min, max, sum, count
 *
 * Aggregation strategy per metric is defined in METRICS.aggregation:
 * - "sum": additive metrics (steps, distance, energy, flights, sleep)
 * - "avg": instantaneous metrics (heart rate, weight, body fat, etc.)
 */

import { type DailySummaryRow, db, type HealthRecordRow } from "@/db";

/**
 * Extract YYYY-MM-DD date string from a Date object in UTC.
 */
function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Compute daily summaries for all metric types that have records in
 * the given import. Updates existing summaries if they overlap.
 */
export async function computeDailySummaries(importId: string): Promise<number> {
  // Get all records from this import
  const records = await db.healthRecords.where("importId").equals(importId).toArray();

  if (records.length === 0) return 0;

  // Group records by metricType and date
  const groups = new Map<string, HealthRecordRow[]>();

  for (const record of records) {
    if (record.value === null) continue;
    const dateKey = toDateKey(record.startTime);
    const groupKey = `${record.metricType}:${dateKey}`;

    const existing = groups.get(groupKey);
    if (existing) {
      existing.push(record);
    } else {
      groups.set(groupKey, [record]);
    }
  }

  // For each group, compute the summary
  const summaries: DailySummaryRow[] = [];

  for (const [groupKey, groupRecords] of groups) {
    const [metricType, date] = groupKey.split(":") as [string, string];
    const values = groupRecords.map((r) => r.value).filter((v): v is number => v !== null);

    if (values.length === 0) continue;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const count = values.length;

    // Check if a summary already exists for this metric+date
    const existingSummary = await db.dailySummaries.get(groupKey);

    if (existingSummary) {
      // Merge with existing summary
      const totalCount = existingSummary.count + count;
      const mergedSum = (existingSummary.sum ?? 0) + sum;
      const mergedAvg = ((existingSummary.avg ?? 0) * existingSummary.count + sum) / totalCount;
      const mergedMin = Math.min(existingSummary.min ?? Number.POSITIVE_INFINITY, min);
      const mergedMax = Math.max(existingSummary.max ?? Number.NEGATIVE_INFINITY, max);

      summaries.push({
        id: groupKey,
        metricType,
        date,
        avg: Math.round(mergedAvg * 100) / 100,
        min: Math.round(mergedMin * 100) / 100,
        max: Math.round(mergedMax * 100) / 100,
        sum: Math.round(mergedSum * 100) / 100,
        count: totalCount,
      });
    } else {
      summaries.push({
        id: groupKey,
        metricType,
        date,
        avg: Math.round(avg * 100) / 100,
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
        sum: Math.round(sum * 100) / 100,
        count,
      });
    }
  }

  // Bulk upsert summaries
  if (summaries.length > 0) {
    await db.dailySummaries.bulkPut(summaries);
  }

  return summaries.length;
}

/**
 * Recompute all daily summaries from scratch.
 * Useful after data deletion or when summaries get out of sync.
 */
export async function recomputeAllSummaries(): Promise<number> {
  // Clear all existing summaries
  await db.dailySummaries.clear();

  // Get all records grouped by metric and date
  const records = await db.healthRecords.toArray();

  const groups = new Map<string, HealthRecordRow[]>();

  for (const record of records) {
    if (record.value === null) continue;
    const dateKey = toDateKey(record.startTime);
    const groupKey = `${record.metricType}:${dateKey}`;

    const existing = groups.get(groupKey);
    if (existing) {
      existing.push(record);
    } else {
      groups.set(groupKey, [record]);
    }
  }

  const summaries: DailySummaryRow[] = [];

  for (const [groupKey, groupRecords] of groups) {
    const [metricType, date] = groupKey.split(":") as [string, string];
    const values = groupRecords.map((r) => r.value).filter((v): v is number => v !== null);

    if (values.length === 0) continue;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;

    summaries.push({
      id: groupKey,
      metricType,
      date,
      avg: Math.round(avg * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      sum: Math.round(sum * 100) / 100,
      count: values.length,
    });
  }

  if (summaries.length > 0) {
    await db.dailySummaries.bulkPut(summaries);
  }

  return summaries.length;
}
