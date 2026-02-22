import { describe, expect, it } from "vitest";
import { APPLE_HEALTH_TYPE_MAP, APPLE_HEALTH_UNIT_CONVERSIONS } from "../apple-health-mapping.js";
import {
  HEALTH_CONNECT_EXERCISE_MAP,
  HEALTH_CONNECT_TYPE_MAP,
  HEALTH_CONNECT_UNIT_CONVERSIONS,
} from "../health-connect-mapping.js";
import { METRICS } from "../metrics.js";

describe("APPLE_HEALTH_TYPE_MAP", () => {
  it("maps all key Apple Health types", () => {
    expect(APPLE_HEALTH_TYPE_MAP.HKQuantityTypeIdentifierStepCount).toBe("step_count");
    expect(APPLE_HEALTH_TYPE_MAP.HKQuantityTypeIdentifierHeartRate).toBe("heart_rate");
    expect(APPLE_HEALTH_TYPE_MAP.HKQuantityTypeIdentifierBodyMass).toBe("body_mass");
    expect(APPLE_HEALTH_TYPE_MAP.HKCategoryTypeIdentifierSleepAnalysis).toBe("sleep_session");
  });

  it("maps blood pressure systolic and diastolic to same type", () => {
    expect(APPLE_HEALTH_TYPE_MAP.HKQuantityTypeIdentifierBloodPressureSystolic).toBe(
      "blood_pressure",
    );
    expect(APPLE_HEALTH_TYPE_MAP.HKQuantityTypeIdentifierBloodPressureDiastolic).toBe(
      "blood_pressure",
    );
  });
});

describe("APPLE_HEALTH_UNIT_CONVERSIONS", () => {
  it("converts miles to km", () => {
    const conv = APPLE_HEALTH_UNIT_CONVERSIONS.mi;
    expect(conv.targetUnit).toBe("km");
    expect(conv.factor).toBeCloseTo(1.60934, 3);
  });

  it("converts pounds to kg", () => {
    const conv = APPLE_HEALTH_UNIT_CONVERSIONS.lb;
    expect(conv.targetUnit).toBe("kg");
    expect(conv.factor).toBeCloseTo(0.453592, 3);
  });

  it("keeps metric units as-is", () => {
    expect(APPLE_HEALTH_UNIT_CONVERSIONS.kg.factor).toBe(1);
    expect(APPLE_HEALTH_UNIT_CONVERSIONS.km.factor).toBe(1);
  });
});

describe("HEALTH_CONNECT_TYPE_MAP", () => {
  it("maps key Health Connect types", () => {
    expect(HEALTH_CONNECT_TYPE_MAP.StepsRecord).toBe("step_count");
    expect(HEALTH_CONNECT_TYPE_MAP.HeartRateRecord).toBe("heart_rate");
    expect(HEALTH_CONNECT_TYPE_MAP.WeightRecord).toBe("body_mass");
    expect(HEALTH_CONNECT_TYPE_MAP.SleepSessionRecord).toBe("sleep_session");
  });

  it("maps exercise sessions to workout", () => {
    expect(HEALTH_CONNECT_TYPE_MAP.ExerciseSessionRecord).toBe("workout");
  });
});

describe("HEALTH_CONNECT_UNIT_CONVERSIONS", () => {
  it("converts meters to km", () => {
    expect(HEALTH_CONNECT_UNIT_CONVERSIONS.meters).toBeDefined();
    expect(HEALTH_CONNECT_UNIT_CONVERSIONS.meters.targetUnit).toBe("km");
    expect(HEALTH_CONNECT_UNIT_CONVERSIONS.meters.factor).toBe(0.001);
  });

  it("converts kilocalories", () => {
    expect(HEALTH_CONNECT_UNIT_CONVERSIONS.kilocalories.targetUnit).toBe("kcal");
    expect(HEALTH_CONNECT_UNIT_CONVERSIONS.kilocalories.factor).toBe(1);
  });

  it("passes through bpm", () => {
    expect(HEALTH_CONNECT_UNIT_CONVERSIONS.bpm.targetUnit).toBe("bpm");
    expect(HEALTH_CONNECT_UNIT_CONVERSIONS.bpm.factor).toBe(1);
  });
});

describe("HEALTH_CONNECT_EXERCISE_MAP", () => {
  it("maps common exercise type IDs", () => {
    expect(HEALTH_CONNECT_EXERCISE_MAP[62]).toBe("walking");
    expect(HEALTH_CONNECT_EXERCISE_MAP[39]).toBe("running");
    expect(HEALTH_CONNECT_EXERCISE_MAP[8]).toBe("biking");
  });

  it("maps swimming and yoga", () => {
    expect(HEALTH_CONNECT_EXERCISE_MAP[56]).toBe("swimming_pool");
    expect(HEALTH_CONNECT_EXERCISE_MAP[73]).toBe("yoga");
  });
});

describe("METRICS", () => {
  it("defines all expected metric types", () => {
    const metricTypes = Object.keys(METRICS);
    expect(metricTypes).toContain("step_count");
    expect(metricTypes).toContain("heart_rate");
    expect(metricTypes).toContain("sleep_session");
    expect(metricTypes).toContain("body_mass");
    expect(metricTypes).toContain("workout");
  });

  it("assigns correct categories", () => {
    expect(METRICS.step_count.category).toBe("activity");
    expect(METRICS.heart_rate.category).toBe("heart");
    expect(METRICS.sleep_session.category).toBe("sleep");
    expect(METRICS.body_mass.category).toBe("body");
    expect(METRICS.oxygen_saturation.category).toBe("vitals");
  });

  it("has units for all metrics", () => {
    for (const [key, metric] of Object.entries(METRICS)) {
      expect(metric.unit, `${key} should have a unit`).toBeTruthy();
    }
  });
});
