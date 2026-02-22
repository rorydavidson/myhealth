/**
 * Data Normalization Service
 *
 * Converts raw parsed records from Apple Health (or future Health Connect)
 * into the internal normalized HealthRecordRow format for IndexedDB storage.
 *
 * - Maps HK type identifiers to internal metric types
 * - Converts units to SI/metric
 * - Generates stable UUIDs for deduplication
 * - Handles special cases (blood pressure, sleep, workouts)
 */

import {
  APPLE_HEALTH_TYPE_MAP,
  APPLE_HEALTH_UNIT_CONVERSIONS,
  HEALTH_CONNECT_TYPE_MAP,
  HEALTH_CONNECT_UNIT_CONVERSIONS,
} from "@health-app/shared";
import type { HealthRecordRow } from "@/db";
import type { ParsedRecord } from "@/workers/apple-health-parser.worker";
import type { HCParsedRecord } from "@/workers/health-connect-parser.worker";

/**
 * Generate a deterministic ID for a health record based on its unique properties.
 * This enables deduplication across repeated imports of the same data.
 *
 * Uses a hash of: metricType + startTime + endTime + value + sourcePlatform + sourceType
 */
async function generateRecordId(
  metricType: string,
  startTime: string,
  endTime: string,
  value: number | null,
  sourcePlatform: string,
  sourceType: string,
): Promise<string> {
  const input = `${metricType}|${startTime}|${endTime}|${value ?? "null"}|${sourcePlatform}|${sourceType}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);

  // Format as UUID v4-like string (not truly random, but consistent format)
  const hex = Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Convert an Apple Health date string to ISO 8601 UTC.
 * Apple Health uses format: "2024-01-15 08:30:00 -0500"
 */
function parseAppleHealthDate(dateStr: string): string {
  if (!dateStr) return new Date(0).toISOString();

  // Apple Health format: "2024-01-15 08:30:00 -0500"
  // We need to convert the timezone offset format from " -0500" to "-05:00"
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{2})(\d{2})$/);
  if (match) {
    const [, date, time, tzHour, tzMin] = match;
    return new Date(`${date}T${time}${tzHour}:${tzMin}`).toISOString();
  }

  // Fallback: try parsing as-is
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0).toISOString();
  }
  return parsed.toISOString();
}

/**
 * Convert a value from Apple Health units to internal SI/metric units.
 */
function convertUnit(value: number | null, unit: string): { value: number | null; unit: string } {
  if (value === null) return { value: null, unit };

  const conversion = APPLE_HEALTH_UNIT_CONVERSIONS[unit];
  if (!conversion) {
    return { value, unit };
  }

  // Special handling for Fahrenheit → Celsius
  if (unit === "degF") {
    return {
      value: (value - 32) * (5 / 9),
      unit: conversion.targetUnit,
    };
  }

  return {
    value: value * conversion.factor,
    unit: conversion.targetUnit,
  };
}

/**
 * Normalize a batch of parsed Apple Health records into HealthRecordRows
 * ready for IndexedDB storage.
 */
export async function normalizeAppleHealthRecords(
  records: ParsedRecord[],
  importId: string,
): Promise<HealthRecordRow[]> {
  const normalized: HealthRecordRow[] = [];

  for (const record of records) {
    // Skip records we don't track
    const metricType = APPLE_HEALTH_TYPE_MAP[record.type];
    if (!metricType && record.type !== "HKWorkout" && record.type !== "HKActivitySummary") {
      continue;
    }

    // Handle workouts specially
    if (record.type === "HKWorkout") {
      const startTime = parseAppleHealthDate(record.startDate);
      const endTime = parseAppleHealthDate(record.endDate);
      const converted = convertUnit(record.value, record.unit);

      const id = await generateRecordId(
        "workout",
        startTime,
        endTime,
        converted.value,
        "apple_health",
        record.type,
      );

      normalized.push({
        id,
        metricType: "workout",
        value: converted.value,
        unit: converted.unit || "min",
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        sourcePlatform: "apple_health",
        sourceDevice: record.sourceName || record.sourceDevice,
        sourceType: (record.metadata?.workoutActivityType as string) || record.type,
        importId,
        metadata: record.metadata,
      });
      continue;
    }

    // Handle activity summaries — skip if no value
    if (record.type === "HKActivitySummary") {
      const startTime = parseAppleHealthDate(record.startDate);
      const converted = convertUnit(record.value, record.unit);

      const id = await generateRecordId(
        "active_energy",
        startTime,
        startTime,
        converted.value,
        "apple_health",
        record.type,
      );

      normalized.push({
        id,
        metricType: "active_energy",
        value: converted.value,
        unit: converted.unit || "kcal",
        startTime: new Date(startTime),
        endTime: new Date(startTime),
        sourcePlatform: "apple_health",
        sourceDevice: record.sourceName,
        sourceType: record.type,
        importId,
        metadata: record.metadata,
      });
      continue;
    }

    // Standard records
    const startTime = parseAppleHealthDate(record.startDate);
    const endTime = parseAppleHealthDate(record.endDate);
    const converted = convertUnit(record.value, record.unit);

    const id = await generateRecordId(
      metricType,
      startTime,
      endTime,
      converted.value,
      "apple_health",
      record.type,
    );

    normalized.push({
      id,
      metricType,
      value: converted.value,
      unit: converted.unit,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      sourcePlatform: "apple_health",
      sourceDevice: record.sourceName || record.sourceDevice,
      sourceType: record.type,
      importId,
      metadata: record.metadata,
    });
  }

  return normalized;
}

// --- Health Connect normalization ---

/**
 * Convert a value from Health Connect units to internal SI/metric units.
 */
function convertHealthConnectUnit(
  value: number | null,
  unit: string,
): { value: number | null; unit: string } {
  if (value === null) return { value: null, unit };

  const conversion = HEALTH_CONNECT_UNIT_CONVERSIONS[unit];
  if (!conversion) return { value, unit };

  return {
    value: value * conversion.factor,
    unit: conversion.targetUnit,
  };
}

/**
 * Normalize a batch of parsed Health Connect records into HealthRecordRows.
 */
export async function normalizeHealthConnectRecords(
  records: HCParsedRecord[],
  importId: string,
): Promise<HealthRecordRow[]> {
  const normalized: HealthRecordRow[] = [];

  for (const record of records) {
    const metricType = HEALTH_CONNECT_TYPE_MAP[record.recordType];
    if (!metricType) continue;

    const startTime = record.startTime;
    const endTime = record.endTime || startTime;

    // Handle blood pressure: map component to the correct source type
    let sourceType = record.recordType;
    if (record.recordType === "BloodPressureRecord" && record.metadata?.component) {
      sourceType = `BloodPressureRecord_${record.metadata.component}`;
    }

    const converted = convertHealthConnectUnit(record.value, record.unit);

    // For workouts, store exercise type as sourceType
    if (record.recordType === "ExerciseSessionRecord") {
      sourceType = record.metadata?.workoutActivityType ?? record.recordType;
    }

    const id = await generateRecordId(
      metricType,
      startTime,
      endTime,
      converted.value,
      "health_connect",
      sourceType,
    );

    normalized.push({
      id,
      metricType,
      value: converted.value,
      unit: converted.unit || record.unit,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      sourcePlatform: "health_connect",
      sourceDevice: record.sourceName || record.sourceDevice,
      sourceType,
      importId,
      metadata: record.metadata,
    });
  }

  return normalized;
}
