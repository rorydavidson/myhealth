import type { MetricType } from "../types/health.js";

/**
 * Maps Apple Health HKQuantityTypeIdentifier / HKCategoryTypeIdentifier
 * to internal metric types.
 */
export const APPLE_HEALTH_TYPE_MAP: Record<string, MetricType> = {
  HKQuantityTypeIdentifierStepCount: "step_count",
  HKQuantityTypeIdentifierDistanceWalkingRunning: "distance",
  HKQuantityTypeIdentifierActiveEnergyBurned: "active_energy",
  HKQuantityTypeIdentifierFlightsClimbed: "flights_climbed",
  HKQuantityTypeIdentifierHeartRate: "heart_rate",
  HKQuantityTypeIdentifierRestingHeartRate: "resting_heart_rate",
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: "hrv",
  HKQuantityTypeIdentifierBodyMass: "body_mass",
  HKQuantityTypeIdentifierBodyFatPercentage: "body_fat",
  HKQuantityTypeIdentifierOxygenSaturation: "oxygen_saturation",
  HKQuantityTypeIdentifierBloodPressureSystolic: "blood_pressure",
  HKQuantityTypeIdentifierBloodPressureDiastolic: "blood_pressure",
  HKQuantityTypeIdentifierRespiratoryRate: "respiratory_rate",
  HKCategoryTypeIdentifierSleepAnalysis: "sleep_session",
};

/**
 * Unit conversions from Apple Health export units to internal SI/metric units.
 * Key: Apple Health unit, Value: { targetUnit, factor }
 * Multiply the Apple Health value by factor to get the internal unit.
 */
export const APPLE_HEALTH_UNIT_CONVERSIONS: Record<string, { targetUnit: string; factor: number }> =
  {
    // Distance
    mi: { targetUnit: "km", factor: 1.60934 },
    m: { targetUnit: "km", factor: 0.001 },
    km: { targetUnit: "km", factor: 1 },
    // Mass
    lb: { targetUnit: "kg", factor: 0.453592 },
    kg: { targetUnit: "kg", factor: 1 },
    // Energy
    Cal: { targetUnit: "kcal", factor: 1 },
    kcal: { targetUnit: "kcal", factor: 1 },
    kJ: { targetUnit: "kcal", factor: 0.239006 },
    // Temperature
    degF: { targetUnit: "degC", factor: 0 }, // Special handling needed
    degC: { targetUnit: "degC", factor: 1 },
    // Pass-through units
    count: { targetUnit: "count", factor: 1 },
    "count/min": { targetUnit: "bpm", factor: 1 },
    ms: { targetUnit: "ms", factor: 1 },
    "%": { targetUnit: "%", factor: 1 },
    mmHg: { targetUnit: "mmHg", factor: 1 },
    "breaths/min": { targetUnit: "breaths/min", factor: 1 },
  };
