import type { MetricType } from "../types/health.js";

/**
 * Maps Google Health Connect record types to internal metric types.
 * Health Connect exports data as JSON with typed record objects.
 */
export const HEALTH_CONNECT_TYPE_MAP: Record<string, MetricType> = {
  StepsRecord: "step_count",
  DistanceRecord: "distance",
  ActiveCaloriesBurnedRecord: "active_energy",
  TotalCaloriesBurnedRecord: "active_energy",
  FloorsClimbedRecord: "flights_climbed",
  HeartRateRecord: "heart_rate",
  RestingHeartRateRecord: "resting_heart_rate",
  HeartRateVariabilityRmssdRecord: "hrv",
  WeightRecord: "body_mass",
  BodyFatRecord: "body_fat",
  OxygenSaturationRecord: "oxygen_saturation",
  BloodPressureRecord: "blood_pressure",
  RespiratoryRateRecord: "respiratory_rate",
  SleepSessionRecord: "sleep_session",
  ExerciseSessionRecord: "workout",
};

/**
 * Unit conversions from Health Connect units to internal SI/metric.
 * Health Connect typically uses metric units already.
 */
export const HEALTH_CONNECT_UNIT_CONVERSIONS: Record<
  string,
  { targetUnit: string; factor: number }
> = {
  // Distance
  meters: { targetUnit: "km", factor: 0.001 },
  kilometers: { targetUnit: "km", factor: 1 },
  miles: { targetUnit: "km", factor: 1.60934 },
  // Mass
  kilograms: { targetUnit: "kg", factor: 1 },
  pounds: { targetUnit: "kg", factor: 0.453592 },
  grams: { targetUnit: "kg", factor: 0.001 },
  // Energy
  kilocalories: { targetUnit: "kcal", factor: 1 },
  calories: { targetUnit: "kcal", factor: 0.001 },
  joules: { targetUnit: "kcal", factor: 0.000239006 },
  kilojoules: { targetUnit: "kcal", factor: 0.239006 },
  // Pass-through
  bpm: { targetUnit: "bpm", factor: 1 },
  milliseconds: { targetUnit: "ms", factor: 1 },
  percentage: { targetUnit: "%", factor: 1 },
  mmHg: { targetUnit: "mmHg", factor: 1 },
  celsius: { targetUnit: "degC", factor: 1 },
  count: { targetUnit: "count", factor: 1 },
  floors: { targetUnit: "count", factor: 1 },
};

/**
 * Maps Health Connect exercise types to internal workout activity type keys.
 */
export const HEALTH_CONNECT_EXERCISE_MAP: Record<number, string> = {
  0: "other",
  2: "badminton",
  4: "baseball",
  5: "basketball",
  8: "biking",
  10: "boxing",
  11: "calisthenics",
  13: "cricket",
  14: "dancing",
  16: "elliptical",
  17: "fencing",
  18: "football_american",
  19: "football",
  22: "golf",
  24: "gymnastics",
  25: "handball",
  26: "hiking",
  27: "hockey",
  29: "martial_arts",
  31: "paddling",
  32: "pilates",
  34: "racquetball",
  35: "rock_climbing",
  37: "rowing",
  38: "rugby",
  39: "running",
  40: "sailing",
  43: "skating",
  44: "skiing",
  46: "snowboarding",
  48: "soccer",
  49: "softball",
  50: "squash",
  51: "stair_climbing",
  52: "strength_training",
  54: "surfing",
  55: "swimming_open_water",
  56: "swimming_pool",
  57: "table_tennis",
  58: "tennis",
  61: "volleyball",
  62: "walking",
  63: "water_polo",
  64: "weightlifting",
  73: "yoga",
  75: "wheelchair",
};
