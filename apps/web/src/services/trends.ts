/**
 * Client-side trend analysis utilities.
 *
 * All computation happens locally from IndexedDB dailySummaries data.
 * Provides trend direction, percentage change, and period comparisons.
 */

import type { DailySummaryRow } from "@/db";

export type TrendDirection = "improving" | "declining" | "stable";

export interface TrendResult {
  /** Current period average */
  current: number | null;
  /** Previous period average */
  previous: number | null;
  /** Percentage change from previous to current period */
  percentChange: number | null;
  /** Direction of the trend */
  direction: TrendDirection;
  /** Whether the change is significant (>10% deviation) */
  isSignificant: boolean;
}

/**
 * Determines whether "improving" means going up or down for a given metric.
 * For most metrics, higher is neutral or contextual.
 * For some (like resting HR), lower is better.
 */
const LOWER_IS_BETTER: Set<string> = new Set([
  "resting_heart_rate",
  "body_fat",
  "body_mass",
  "respiratory_rate",
]);

/**
 * Compute trend direction and percentage change between two periods.
 *
 * @param currentData - Data for the current period (e.g., this week)
 * @param previousData - Data for the previous period (e.g., last week)
 * @param metricType - The metric type (used to determine if lower is better)
 * @param valueField - Which field to use for comparison (sum or avg)
 */
export function computeTrend(
  currentData: DailySummaryRow[],
  previousData: DailySummaryRow[],
  metricType: string,
  valueField: "sum" | "avg" = "avg",
): TrendResult {
  const currentAvg = computeAverage(currentData, valueField);
  const previousAvg = computeAverage(previousData, valueField);

  if (currentAvg === null || previousAvg === null || previousAvg === 0) {
    return {
      current: currentAvg,
      previous: previousAvg,
      percentChange: null,
      direction: "stable",
      isSignificant: false,
    };
  }

  const percentChange = ((currentAvg - previousAvg) / previousAvg) * 100;
  const absChange = Math.abs(percentChange);
  const isSignificant = absChange > 10;

  let direction: TrendDirection;
  if (absChange < 2) {
    direction = "stable";
  } else {
    const isGoingUp = percentChange > 0;
    const lowerIsBetter = LOWER_IS_BETTER.has(metricType);

    if (lowerIsBetter) {
      direction = isGoingUp ? "declining" : "improving";
    } else {
      direction = isGoingUp ? "improving" : "declining";
    }
  }

  return {
    current: currentAvg,
    previous: previousAvg,
    percentChange: Math.round(percentChange * 10) / 10,
    direction,
    isSignificant,
  };
}

/**
 * Compute the average value from an array of daily summaries.
 */
function computeAverage(data: DailySummaryRow[], valueField: "sum" | "avg"): number | null {
  const values = data
    .map((d) => d[valueField])
    .filter((v): v is number => v !== null && v !== undefined);

  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Split daily summaries into two consecutive periods of equal length.
 * Returns [currentPeriod, previousPeriod] where current is most recent.
 *
 * @param data - Sorted daily summaries (ascending by date)
 * @param periodDays - Length of each period in days
 */
export function splitIntoPeriods(
  data: DailySummaryRow[],
  periodDays: number,
): [DailySummaryRow[], DailySummaryRow[]] {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const currentStart = new Date(today);
  currentStart.setDate(currentStart.getDate() - periodDays + 1);
  currentStart.setHours(0, 0, 0, 0);

  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - periodDays);

  const currentStartKey = toDateKey(currentStart);
  const previousStartKey = toDateKey(previousStart);
  const currentEndKey = toDateKey(today);
  const previousEndKey = toDateKey(new Date(currentStart.getTime() - 1));

  const current = data.filter((d) => d.date >= currentStartKey && d.date <= currentEndKey);
  const previous = data.filter((d) => d.date >= previousStartKey && d.date <= previousEndKey);

  return [current, previous];
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Compute the Pearson correlation coefficient between two arrays of values.
 * Values are matched by index — both arrays must be the same length.
 *
 * @returns Correlation coefficient (-1 to 1), or null if insufficient data
 */
export function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return null;

  return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * Categorize a correlation strength.
 */
export function correlationStrength(r: number | null): "strong" | "moderate" | "weak" | "none" {
  if (r === null) return "none";
  const abs = Math.abs(r);
  if (abs >= 0.7) return "strong";
  if (abs >= 0.4) return "moderate";
  return "weak";
}

/**
 * Generate sparkline data points from daily summaries.
 * Returns an array of numeric values for miniature charting.
 */
export function generateSparklineData(
  data: DailySummaryRow[],
  valueField: "sum" | "avg",
  maxPoints = 14,
): number[] {
  const values = data
    .map((d) => d[valueField])
    .filter((v): v is number => v !== null && v !== undefined);

  if (values.length <= maxPoints) return values;

  // Downsample by averaging groups
  const groupSize = Math.ceil(values.length / maxPoints);
  const result: number[] = [];
  for (let i = 0; i < values.length; i += groupSize) {
    const group = values.slice(i, i + groupSize);
    result.push(group.reduce((a, b) => a + b, 0) / group.length);
  }
  return result;
}
