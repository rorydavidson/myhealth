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
 *
 * Cross-source deduplication
 * --------------------------
 * The same real-world event (e.g. a night's sleep) can be imported from
 * multiple sources (Apple Health, Google Health Connect, Whoop). Each source
 * stores its own record, so without dedup a metric would be double-counted.
 *
 * Rule: for each (metricType, calendar day) bucket, only the records from the
 * FIRST-imported source are kept; later sources are ignored for that bucket.
 * "First-imported" is decided by the earliest import startedAt per platform.
 * This is non-destructive — raw records are untouched; dedup happens only when
 * summaries are (re)computed.
 */

import { type DailySummaryRow, db, type HealthRecordRow } from "@/db";

/**
 * Extract YYYY-MM-DD date string from a Date object in UTC.
 */
function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Lower value = earlier import = higher priority. */
type SourceRank = Map<string, number>;

/** Sleep stages that represent time actually asleep (not in bed, not awake). */
const ASLEEP_STAGES = new Set(["asleep", "core", "deep", "rem"]);

/**
 * Total hours covered by a set of [start, end] intervals, merging overlaps so
 * overlapping or duplicate segments are counted once.
 */
function mergeIntervalHours(intervals: Array<[number, number]>): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curStart, curEnd] = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    if (s <= curEnd) {
      // Overlaps or touches the current interval — extend it.
      if (e > curEnd) curEnd = e;
    } else {
      total += curEnd - curStart;
      [curStart, curEnd] = [s, e];
    }
  }
  total += curEnd - curStart;
  return total / 3_600_000; // ms → hours
}

/**
 * Sleep duration (hours) for one day's records from a single source.
 *
 * Apple Health stores sleep as many overlapping segments per night: a top-level
 * "inBed" interval PLUS the "core/deep/rem/awake" stage segments that tile it,
 * often duplicated across devices/apps. Naively summing those values massively
 * overcounts (e.g. 47 h). Instead we take the merged union of the asleep-stage
 * intervals — the real time asleep. Whoop and Google emit one value-per-session
 * record (no per-stage metadata), so those keep their value.
 */
function computeSleepHours(records: HealthRecordRow[]): number {
  const staged = records.filter((r) => typeof r.metadata?.sleepStage === "string");

  // No per-stage data (Whoop, or Google without stages): values are already
  // per-session sleep hours.
  if (staged.length === 0) {
    return records.reduce((acc, r) => acc + (r.value ?? 0), 0);
  }

  const toInterval = (r: HealthRecordRow): [number, number] => [
    r.startTime.getTime(),
    r.endTime.getTime(),
  ];

  const asleep = staged
    .filter((r) => ASLEEP_STAGES.has(r.metadata?.sleepStage as string))
    .map(toInterval);
  if (asleep.length > 0) return mergeIntervalHours(asleep);

  // Only "inBed"/"awake" segments exist — fall back to the in-bed span so the
  // night still shows something rather than nothing.
  const inBed = staged.filter((r) => r.metadata?.sleepStage === "inBed").map(toInterval);
  return mergeIntervalHours(inBed);
}

/**
 * Build a source-priority map keyed by sourcePlatform. The rank is the earliest
 * import startedAt (ms) for that platform, so the source a user imported first
 * wins ties for any overlapping metric+day.
 */
function buildSourceRank(imports: { platform: string; startedAt: Date }[]): SourceRank {
  const rank: SourceRank = new Map();
  for (const imp of imports) {
    const t = imp.startedAt.getTime();
    const current = rank.get(imp.platform);
    if (current === undefined || t < current) {
      rank.set(imp.platform, t);
    }
  }
  return rank;
}

/**
 * Given records that all share the same (metricType, day) bucket, return only
 * those belonging to the winning source — the one whose platform was imported
 * earliest. Records from unknown platforms (no import row) rank lowest, and if
 * every record is from an unknown platform they are all kept.
 */
function keepFirstImportedSource(
  bucketRecords: HealthRecordRow[],
  rank: SourceRank,
): HealthRecordRow[] {
  let winner: string | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const r of bucketRecords) {
    const r1 = rank.get(r.sourcePlatform) ?? Number.POSITIVE_INFINITY;
    // Strict <, with a deterministic tiebreak on platform name, so the result
    // is stable regardless of record order.
    if (r1 < best || (r1 === best && (winner === null || r.sourcePlatform < winner))) {
      best = r1;
      winner = r.sourcePlatform;
    }
  }
  if (winner === null) return bucketRecords;
  return bucketRecords.filter((r) => r.sourcePlatform === winner);
}

/**
 * Group records by metricType+date, drop duplicate sources per bucket, and
 * build a DailySummaryRow for each surviving bucket.
 */
function summariseGroups(
  records: HealthRecordRow[],
  rank: SourceRank,
  onlyDates?: Map<string, Set<string>>,
): DailySummaryRow[] {
  const groups = new Map<string, HealthRecordRow[]>();
  for (const record of records) {
    if (record.value === null) continue;
    const dateKey = toDateKey(record.startTime);
    if (onlyDates && !onlyDates.get(record.metricType)?.has(dateKey)) continue;
    const groupKey = `${record.metricType}:${dateKey}`;
    const existing = groups.get(groupKey);
    if (existing) existing.push(record);
    else groups.set(groupKey, [record]);
  }

  const summaries: DailySummaryRow[] = [];
  for (const [groupKey, groupRecords] of groups) {
    const [metricType, date] = groupKey.split(":") as [string, string];
    const deduped = keepFirstImportedSource(groupRecords, rank);

    // Sleep needs interval-union aggregation, not a sum of overlapping
    // stage/in-bed segments (which would massively overcount).
    if (metricType === "sleep_session") {
      const hours = Math.round(computeSleepHours(deduped) * 100) / 100;
      if (hours <= 0) continue;
      summaries.push({
        id: groupKey,
        metricType,
        date,
        avg: hours,
        min: hours,
        max: hours,
        sum: hours,
        count: deduped.length,
      });
      continue;
    }

    const values = deduped.map((r) => r.value).filter((v): v is number => v !== null);
    if (values.length === 0) continue;

    const sum = values.reduce((a, b) => a + b, 0);
    summaries.push({
      id: groupKey,
      metricType,
      date,
      avg: Math.round((sum / values.length) * 100) / 100,
      min: Math.round(Math.min(...values) * 100) / 100,
      max: Math.round(Math.max(...values) * 100) / 100,
      sum: Math.round(sum * 100) / 100,
      count: values.length,
    });
  }
  return summaries;
}

/**
 * Compute daily summaries for the metric/date buckets touched by the given
 * import. Each affected bucket is fully recomputed from the current records
 * across all sources (deduped), then overwritten — never incrementally merged.
 * This keeps summaries correct when a second source, or a re-sync of the same
 * source, adds overlapping data.
 */
export async function computeDailySummaries(importId: string): Promise<number> {
  const importRecords = await db.healthRecords.where("importId").equals(importId).toArray();
  if (importRecords.length === 0) return 0;

  const imports = await db.imports.toArray();
  const rank = buildSourceRank(imports);

  // Fast path: the first import ever has no other source to dedupe against, and
  // its own records are the complete dataset for the buckets it touches — so we
  // can summarise directly without re-reading the table. This keeps the large
  // initial Apple Health import to a single in-memory pass.
  if (imports.length <= 1) {
    const summaries = summariseGroups(importRecords, rank);
    if (summaries.length > 0) {
      await db.dailySummaries.bulkPut(summaries);
    }
    return summaries.length;
  }

  // Which (metricType, day) buckets did this import touch?
  const affected = new Map<string, Set<string>>();
  for (const record of importRecords) {
    if (record.value === null) continue;
    const dateKey = toDateKey(record.startTime);
    const set = affected.get(record.metricType);
    if (set) set.add(dateKey);
    else affected.set(record.metricType, new Set([dateKey]));
  }
  if (affected.size === 0) return 0;

  // For each affected metricType, reload every record in the touched date span
  // (all sources) so dedup can see cross-source duplicates, then recompute only
  // the affected days.
  const summaries: DailySummaryRow[] = [];
  for (const [metricType, dateKeys] of affected) {
    const sortedDays = [...dateKeys].sort();
    const lo = new Date(`${sortedDays[0]}T00:00:00.000Z`);
    const hi = new Date(`${sortedDays[sortedDays.length - 1]}T23:59:59.999Z`);

    const spanRecords = await db.healthRecords
      .where("[metricType+startTime]")
      .between([metricType, lo], [metricType, hi], true, true)
      .toArray();

    summaries.push(...summariseGroups(spanRecords, rank, new Map([[metricType, dateKeys]])));
  }

  if (summaries.length > 0) {
    await db.dailySummaries.bulkPut(summaries);
  }
  return summaries.length;
}

/**
 * Recompute all daily summaries from scratch, deduplicating across sources.
 * Useful after data deletion, when summaries get out of sync, or to retro-fix
 * already-imported data that was double-counted before dedup existed.
 */
export async function recomputeAllSummaries(): Promise<number> {
  await db.dailySummaries.clear();

  const records = await db.healthRecords.toArray();
  if (records.length === 0) return 0;

  const rank = buildSourceRank(await db.imports.toArray());
  const summaries = summariseGroups(records, rank);

  if (summaries.length > 0) {
    await db.dailySummaries.bulkPut(summaries);
  }
  return summaries.length;
}
