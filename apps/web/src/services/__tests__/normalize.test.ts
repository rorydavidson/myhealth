/**
 * Unit tests for the data normalization service.
 * Tests Apple Health and Health Connect record normalization.
 */

import { describe, expect, it } from "vitest";
import { normalizeAppleHealthRecords, normalizeHealthConnectRecords } from "../normalize";
import type { ParsedRecord } from "@/workers/apple-health-parser.worker";
import type { HCParsedRecord } from "@/workers/health-connect-parser.worker";

const IMPORT_ID = "test-import-123";

describe("normalizeAppleHealthRecords", () => {
  it("maps step count records correctly", async () => {
    const records: ParsedRecord[] = [
      {
        type: "HKQuantityTypeIdentifierStepCount",
        value: 8247,
        unit: "count",
        startDate: "2024-03-15 08:00:00 -0500",
        endDate: "2024-03-15 08:59:00 -0500",
        sourceName: "iPhone",
        sourceDevice: "iPhone 15",
        metadata: {},
      },
    ];

    const result = await normalizeAppleHealthRecords(records, IMPORT_ID);

    expect(result).toHaveLength(1);
    const record = result[0];
    expect(record.metricType).toBe("step_count");
    expect(record.value).toBe(8247);
    expect(record.unit).toBe("count");
    expect(record.sourcePlatform).toBe("apple_health");
    expect(record.importId).toBe(IMPORT_ID);
  });

  it("converts miles to kilometres", async () => {
    const records: ParsedRecord[] = [
      {
        type: "HKQuantityTypeIdentifierDistanceWalkingRunning",
        value: 3.1,
        unit: "mi",
        startDate: "2024-03-15 08:00:00 +0000",
        endDate: "2024-03-15 08:30:00 +0000",
        sourceName: "Apple Watch",
        sourceDevice: "Apple Watch",
        metadata: {},
      },
    ];

    const result = await normalizeAppleHealthRecords(records, IMPORT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].unit).toBe("km");
    expect(result[0].value).toBeCloseTo(3.1 * 1.60934, 3);
  });

  it("converts pounds to kilograms", async () => {
    const records: ParsedRecord[] = [
      {
        type: "HKQuantityTypeIdentifierBodyMass",
        value: 165,
        unit: "lb",
        startDate: "2024-03-15 08:00:00 +0000",
        endDate: "2024-03-15 08:00:00 +0000",
        sourceName: "Scale",
        sourceDevice: "Scale",
        metadata: {},
      },
    ];

    const result = await normalizeAppleHealthRecords(records, IMPORT_ID);

    // 165 lb = ~74.84 kg
    expect(result).toHaveLength(1);
    expect(result[0].unit).toBe("kg");
    expect(result[0].value).toBeCloseTo(165 * 0.453592, 3);
  });

  it("skips unknown metric types", async () => {
    const records: ParsedRecord[] = [
      {
        type: "HKQuantityTypeIdentifierUnknownFutureType",
        value: 42,
        unit: "count",
        startDate: "2024-03-15 08:00:00 +0000",
        endDate: "2024-03-15 08:00:00 +0000",
        sourceName: "App",
        sourceDevice: "iPhone",
        metadata: {},
      },
    ];

    const result = await normalizeAppleHealthRecords(records, IMPORT_ID);
    expect(result).toHaveLength(0);
  });

  it("normalizes workout records to 'workout' metricType", async () => {
    const records: ParsedRecord[] = [
      {
        type: "HKWorkout",
        value: 45,
        unit: "min",
        startDate: "2024-03-15 07:00:00 +0000",
        endDate: "2024-03-15 07:45:00 +0000",
        sourceName: "Apple Watch",
        sourceDevice: "Apple Watch",
        metadata: { workoutActivityType: "HKWorkoutActivityTypeRunning" },
      },
    ];

    const result = await normalizeAppleHealthRecords(records, IMPORT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].metricType).toBe("workout");
    expect(result[0].sourcePlatform).toBe("apple_health");
  });

  it("generates deterministic IDs for same record", async () => {
    const records: ParsedRecord[] = [
      {
        type: "HKQuantityTypeIdentifierHeartRate",
        value: 72,
        unit: "count/min",
        startDate: "2024-03-15 10:00:00 +0000",
        endDate: "2024-03-15 10:00:00 +0000",
        sourceName: "Apple Watch",
        sourceDevice: "Apple Watch",
        metadata: {},
      },
    ];

    const result1 = await normalizeAppleHealthRecords(records, IMPORT_ID);
    const result2 = await normalizeAppleHealthRecords(records, IMPORT_ID);

    expect(result1[0].id).toBe(result2[0].id);
  });

  it("parses Apple Health date format with timezone offset correctly", async () => {
    const records: ParsedRecord[] = [
      {
        type: "HKQuantityTypeIdentifierStepCount",
        value: 1000,
        unit: "count",
        startDate: "2024-01-15 08:30:00 -0500",
        endDate: "2024-01-15 08:59:00 -0500",
        sourceName: "iPhone",
        sourceDevice: "iPhone",
        metadata: {},
      },
    ];

    const result = await normalizeAppleHealthRecords(records, IMPORT_ID);

    expect(result).toHaveLength(1);
    // 08:30 -0500 = 13:30 UTC
    expect(result[0].startTime.toISOString()).toContain("13:30:00");
  });

  it("returns startTime and endTime as Date objects", async () => {
    const records: ParsedRecord[] = [
      {
        type: "HKQuantityTypeIdentifierStepCount",
        value: 500,
        unit: "count",
        startDate: "2024-03-15 09:00:00 +0000",
        endDate: "2024-03-15 09:30:00 +0000",
        sourceName: "iPhone",
        sourceDevice: "iPhone",
        metadata: {},
      },
    ];

    const result = await normalizeAppleHealthRecords(records, IMPORT_ID);
    expect(result[0].startTime).toBeInstanceOf(Date);
    expect(result[0].endTime).toBeInstanceOf(Date);
  });

  it("maps heart rate unit count/min to bpm", async () => {
    const records: ParsedRecord[] = [
      {
        type: "HKQuantityTypeIdentifierHeartRate",
        value: 72,
        unit: "count/min",
        startDate: "2024-03-15 10:00:00 +0000",
        endDate: "2024-03-15 10:00:00 +0000",
        sourceName: "Apple Watch",
        sourceDevice: "Apple Watch",
        metadata: {},
      },
    ];

    const result = await normalizeAppleHealthRecords(records, IMPORT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].unit).toBe("bpm");
    expect(result[0].value).toBe(72);
  });
});

describe("normalizeHealthConnectRecords", () => {
  it("maps step count records correctly", async () => {
    const records: HCParsedRecord[] = [
      {
        recordType: "StepsRecord",
        value: 6500,
        unit: "count",
        startTime: "2024-03-15T08:00:00Z",
        endTime: "2024-03-15T08:59:00Z",
        sourceName: "Pixel Watch",
        sourceDevice: "Pixel Watch",
        metadata: {},
      },
    ];

    const result = await normalizeHealthConnectRecords(records, IMPORT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].metricType).toBe("step_count");
    expect(result[0].value).toBe(6500);
    expect(result[0].sourcePlatform).toBe("health_connect");
  });

  it("skips unknown Health Connect record types", async () => {
    const records: HCParsedRecord[] = [
      {
        recordType: "SomeUnknownRecord",
        value: 99,
        unit: "count",
        startTime: "2024-03-15T08:00:00Z",
        endTime: "2024-03-15T08:00:00Z",
        sourceName: "App",
        sourceDevice: "Phone",
        metadata: {},
      },
    ];

    const result = await normalizeHealthConnectRecords(records, IMPORT_ID);
    expect(result).toHaveLength(0);
  });

  it("appends blood pressure component to sourceType for BloodPressureRecord", async () => {
    const records: HCParsedRecord[] = [
      {
        recordType: "BloodPressureRecord",
        value: 120,
        unit: "mmHg",
        startTime: "2024-03-15T09:00:00Z",
        endTime: "2024-03-15T09:00:00Z",
        sourceName: "Health Connect",
        sourceDevice: "Pixel",
        metadata: { component: "systolic" },
      },
    ];

    const result = await normalizeHealthConnectRecords(records, IMPORT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe("BloodPressureRecord_systolic");
  });

  it("uses workoutActivityType as sourceType for ExerciseSessionRecord", async () => {
    const records: HCParsedRecord[] = [
      {
        recordType: "ExerciseSessionRecord",
        value: 45,
        unit: "min",
        startTime: "2024-03-15T07:00:00Z",
        endTime: "2024-03-15T07:45:00Z",
        sourceName: "Health Connect",
        sourceDevice: "Pixel Watch",
        metadata: { workoutActivityType: "EXERCISE_TYPE_RUNNING" },
      },
    ];

    const result = await normalizeHealthConnectRecords(records, IMPORT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe("EXERCISE_TYPE_RUNNING");
  });

  it("falls back to recordType as sourceType for ExerciseSessionRecord with no workoutActivityType", async () => {
    const records: HCParsedRecord[] = [
      {
        recordType: "ExerciseSessionRecord",
        value: 30,
        unit: "min",
        startTime: "2024-03-15T07:00:00Z",
        endTime: "2024-03-15T07:30:00Z",
        sourceName: "Health Connect",
        sourceDevice: "Pixel Watch",
        metadata: {},
      },
    ];

    const result = await normalizeHealthConnectRecords(records, IMPORT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe("ExerciseSessionRecord");
  });

  it("uses startTime for endTime when endTime is absent", async () => {
    const records: HCParsedRecord[] = [
      {
        recordType: "StepsRecord",
        value: 500,
        unit: "count",
        startTime: "2024-03-15T08:00:00Z",
        endTime: undefined as unknown as string,
        sourceName: "App",
        sourceDevice: "Phone",
        metadata: {},
      },
    ];

    const result = await normalizeHealthConnectRecords(records, IMPORT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].startTime.toISOString()).toBe(result[0].endTime.toISOString());
  });
});

describe("normalizeAppleHealthRecords — HKActivitySummary", () => {
  it("maps HKActivitySummary records to active_energy metricType", async () => {
    const records: ParsedRecord[] = [
      {
        type: "HKActivitySummary",
        value: 350,
        unit: "Cal",
        startDate: "2024-03-15 00:00:00 +0000",
        endDate: "2024-03-15 23:59:00 +0000",
        sourceName: "iPhone",
        sourceDevice: "iPhone 15",
        metadata: {},
      } as unknown as ParsedRecord,
    ];

    const result = await normalizeAppleHealthRecords(records, IMPORT_ID);

    expect(result).toHaveLength(1);
    const record = result[0];
    expect(record.metricType).toBe("active_energy");
    expect(record.sourcePlatform).toBe("apple_health");
    expect(record.sourceType).toBe("HKActivitySummary");
    // endTime should equal startTime for activity summaries
    expect(record.startTime.toISOString()).toBe(record.endTime.toISOString());
  });
});
