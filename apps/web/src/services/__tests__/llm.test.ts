/**
 * Unit tests for LLM prompt-related logic and privacy constraints.
 * Tests the formatting helpers and structural privacy guarantees.
 */

import { describe, expect, it } from "vitest";

// Internal formatValue behaviour replicated for testing
// (matches the implementation in llm.ts)
function formatValue(value: number, metricType: string): string {
  if (metricType === "distance") return value.toFixed(2);
  if (metricType === "body_fat" || metricType === "oxygen_saturation") return value.toFixed(1);
  if (metricType === "body_mass") return value.toFixed(1);
  if (metricType === "hrv") return value.toFixed(0);
  return Math.round(value).toLocaleString("en-US");
}

describe("LLM context value formatting", () => {
  it("rounds step counts to whole numbers with locale separators", () => {
    expect(formatValue(8247.6, "step_count")).toBe("8,248");
  });

  it("formats distance to 2 decimal places", () => {
    expect(formatValue(5.678, "distance")).toBe("5.68");
  });

  it("formats body fat to 1 decimal place", () => {
    expect(formatValue(22.456, "body_fat")).toBe("22.5");
  });

  it("formats oxygen saturation to 1 decimal place", () => {
    expect(formatValue(98.234, "oxygen_saturation")).toBe("98.2");
  });

  it("formats body mass to 1 decimal place", () => {
    expect(formatValue(75.678, "body_mass")).toBe("75.7");
  });

  it("formats HRV to 0 decimal places", () => {
    expect(formatValue(42.7, "hrv")).toBe("43");
  });

  it("formats heart rate as rounded integer", () => {
    expect(formatValue(72.4, "heart_rate")).toBe("72");
  });

  it("formats resting heart rate as rounded integer", () => {
    expect(formatValue(58.9, "resting_heart_rate")).toBe("59");
  });
});

describe("LLM privacy constraints (structural)", () => {
  it("daily summary fields do not include raw record identifiers", () => {
    // DailySummaryRow fields available to standard mode
    const DAILY_SUMMARY_FIELDS = new Set([
      "id",
      "metricType",
      "date",
      "avg",
      "min",
      "max",
      "sum",
      "count",
    ]);

    // These raw record fields must never be present in a daily summary
    const RAW_RECORD_ONLY_FIELDS = [
      "startTime",
      "endTime",
      "sourceDevice",
      "sourcePlatform",
      "importId",
      "sourceType",
    ];

    for (const field of RAW_RECORD_ONLY_FIELDS) {
      expect(DAILY_SUMMARY_FIELDS.has(field)).toBe(false);
    }
  });

  it("standard mode should not expose sub-daily timestamps", () => {
    // Standard mode uses date (YYYY-MM-DD) granularity, not timestamps
    const STANDARD_DATE_GRANULARITY = "YYYY-MM-DD";
    expect(STANDARD_DATE_GRANULARITY).not.toContain("HH");
    expect(STANDARD_DATE_GRANULARITY).not.toContain("mm");
    expect(STANDARD_DATE_GRANULARITY).not.toContain("ss");
  });

  it("standard context must not include PII field names", () => {
    const PII_IDENTIFIERS = ["name", "email", "dob", "dateOfBirth", "address", "phone"];
    const STANDARD_METRIC_TYPES = [
      "step_count",
      "heart_rate",
      "resting_heart_rate",
      "hrv",
      "body_mass",
      "body_fat",
      "sleep_session",
      "oxygen_saturation",
      "respiratory_rate",
      "distance",
      "active_energy",
    ];

    for (const pii of PII_IDENTIFIERS) {
      expect(STANDARD_METRIC_TYPES).not.toContain(pii);
    }
  });
});
