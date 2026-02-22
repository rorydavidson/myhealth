import { describe, expect, it } from "vitest";
import { LAB_CODING } from "../lab-coding.js";
import { METRIC_CODING } from "../metric-coding.js";

describe("METRIC_CODING", () => {
  it("has LOINC codes for key vital signs", () => {
    const vitals = [
      "heart_rate",
      "resting_heart_rate",
      "blood_pressure",
      "oxygen_saturation",
      "respiratory_rate",
      "body_mass",
    ] as const;

    for (const metric of vitals) {
      const coding = METRIC_CODING[metric];
      expect(coding).toBeDefined();
      expect(coding?.loinc).toBeDefined();
      expect(coding?.loinc?.code).toBeTruthy();
      expect(coding?.loinc?.system).toBe("http://loinc.org");
    }
  });

  it("has correct LOINC code for heart rate", () => {
    expect(METRIC_CODING.heart_rate?.loinc?.code).toBe("8867-4");
  });

  it("has correct LOINC code for blood pressure panel", () => {
    expect(METRIC_CODING.blood_pressure?.loinc?.code).toBe("85354-9");
  });

  it("has correct LOINC code for body weight", () => {
    expect(METRIC_CODING.body_mass?.loinc?.code).toBe("29463-7");
  });

  it("includes SNOMED CT codes where available", () => {
    const withSnomed = METRIC_CODING.heart_rate;
    expect(withSnomed?.snomed).toBeDefined();
    expect(withSnomed?.snomed?.system).toBe("http://snomed.info/sct");
    expect(withSnomed?.snomed?.code).toBe("364075005");
  });

  it("has LOINC codes for activity metrics", () => {
    expect(METRIC_CODING.step_count?.loinc?.code).toBe("55423-8");
    expect(METRIC_CODING.active_energy?.loinc?.code).toBe("41981-2");
    expect(METRIC_CODING.distance?.loinc?.code).toBe("41953-1");
  });
});

describe("LAB_CODING", () => {
  it("has LOINC codes for common lab tests", () => {
    const tests = ["hdl", "ldl", "triglycerides", "hemoglobin", "platelets", "tsh"];

    for (const test of tests) {
      expect(LAB_CODING[test]).toBeDefined();
      expect(LAB_CODING[test].code).toBeTruthy();
      expect(LAB_CODING[test].system).toBe("http://loinc.org");
    }
  });

  it("maps A1C aliases correctly", () => {
    expect(LAB_CODING["hemoglobin a1c"].code).toBe("4548-4");
    expect(LAB_CODING.hba1c.code).toBe("4548-4");
    expect(LAB_CODING.a1c.code).toBe("4548-4");
  });

  it("maps HDL aliases correctly", () => {
    expect(LAB_CODING.hdl.code).toBe("2085-9");
    expect(LAB_CODING["hdl cholesterol"].code).toBe("2085-9");
  });

  it("has correct LOINC for total cholesterol", () => {
    expect(LAB_CODING["total cholesterol"].code).toBe("2093-3");
    expect(LAB_CODING.cholesterol.code).toBe("2093-3");
  });
});
