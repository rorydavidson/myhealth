import { z } from "zod";

const metricTypes = [
  "step_count",
  "distance",
  "active_energy",
  "flights_climbed",
  "heart_rate",
  "resting_heart_rate",
  "hrv",
  "body_mass",
  "body_fat",
  "sleep_session",
  "oxygen_saturation",
  "blood_pressure",
  "respiratory_rate",
  "workout",
] as const;

const sourcePlatforms = ["apple_health", "health_connect"] as const;

export const healthRecordSchema = z.object({
  id: z.string().uuid(),
  metricType: z.enum(metricTypes),
  value: z.number().nullable(),
  unit: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  sourcePlatform: z.enum(sourcePlatforms),
  sourceDevice: z.string(),
  sourceType: z.string(),
  importId: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export const dailySummarySchema = z.object({
  id: z.string(),
  metricType: z.enum(metricTypes),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  avg: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  sum: z.number().nullable(),
  count: z.number().int().nonnegative(),
});

export const labResultStructuredValueSchema = z.object({
  value: z.number(),
  unit: z.string(),
  flag: z.enum(["normal", "low", "high", "critical_low", "critical_high"]).optional(),
  referenceRange: z.string().optional(),
  loincCode: z.string().optional(),
});

export const importSchema = z.object({
  id: z.string(),
  platform: z.enum(sourcePlatforms),
  fileName: z.string(),
  exportDate: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  recordCount: z.number().int().nonnegative(),
  status: z.enum(["processing", "completed", "failed"]),
  dateRange: z
    .object({
      earliest: z.string().datetime(),
      latest: z.string().datetime(),
    })
    .nullable(),
});
