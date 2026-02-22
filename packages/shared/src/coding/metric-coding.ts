import type { MetricType } from "../types/health.js";

export interface ClinicalCode {
  code: string;
  display: string;
  system: string;
}

export interface MetricCoding {
  loinc?: ClinicalCode;
  snomed?: ClinicalCode;
}

const LOINC_SYSTEM = "http://loinc.org";
const SNOMED_SYSTEM = "http://snomed.info/sct";

/**
 * Maps internal metric types to their LOINC (primary) and SNOMED CT (supplementary) codes.
 * Used at export time (IPS generation) and for clinical context in the UI.
 * Codes marked with TODO should be verified against a local Snowstorm server.
 */
export const METRIC_CODING: Partial<Record<MetricType, MetricCoding>> = {
  heart_rate: {
    loinc: { code: "8867-4", display: "Heart rate", system: LOINC_SYSTEM },
    snomed: { code: "364075005", display: "Heart rate", system: SNOMED_SYSTEM },
  },
  resting_heart_rate: {
    loinc: {
      code: "40443-4",
      display: "Resting heart rate",
      system: LOINC_SYSTEM,
    },
    snomed: {
      code: "444981005",
      display: "Resting heart rate",
      system: SNOMED_SYSTEM,
    },
  },
  hrv: {
    loinc: {
      code: "80404-7",
      display: "R-R interval.standard deviation",
      system: LOINC_SYSTEM,
    },
    // TODO: Verify SNOMED CT code via local Snowstorm server
  },
  blood_pressure: {
    loinc: {
      code: "85354-9",
      display: "Blood pressure panel",
      system: LOINC_SYSTEM,
    },
    snomed: {
      code: "75367002",
      display: "Blood pressure",
      system: SNOMED_SYSTEM,
    },
  },
  oxygen_saturation: {
    loinc: {
      code: "2708-6",
      display: "Oxygen saturation",
      system: LOINC_SYSTEM,
    },
    snomed: {
      code: "431314004",
      display: "Peripheral oxygen saturation",
      system: SNOMED_SYSTEM,
    },
  },
  respiratory_rate: {
    loinc: {
      code: "9279-1",
      display: "Respiratory rate",
      system: LOINC_SYSTEM,
    },
    snomed: {
      code: "86290005",
      display: "Respiratory rate",
      system: SNOMED_SYSTEM,
    },
  },
  body_mass: {
    loinc: { code: "29463-7", display: "Body weight", system: LOINC_SYSTEM },
    snomed: {
      code: "27113001",
      display: "Body weight",
      system: SNOMED_SYSTEM,
    },
  },
  body_fat: {
    loinc: {
      code: "41982-0",
      display: "Percentage of body fat",
      system: LOINC_SYSTEM,
    },
    // TODO: Verify SNOMED CT code via local Snowstorm server
  },
  step_count: {
    loinc: {
      code: "55423-8",
      display: "Number of steps in unspecified time",
      system: LOINC_SYSTEM,
    },
    // TODO: Verify SNOMED CT code via local Snowstorm server
  },
  active_energy: {
    loinc: {
      code: "41981-2",
      display: "Calories burned",
      system: LOINC_SYSTEM,
    },
    // TODO: Verify SNOMED CT code via local Snowstorm server
  },
  distance: {
    loinc: {
      code: "41953-1",
      display: "Walking distance",
      system: LOINC_SYSTEM,
    },
    // TODO: Verify SNOMED CT code via local Snowstorm server
  },
  sleep_session: {
    loinc: {
      code: "93832-4",
      display: "Sleep duration",
      system: LOINC_SYSTEM,
    },
    snomed: {
      code: "248263006",
      display: "Duration of sleep",
      system: SNOMED_SYSTEM,
    },
  },
};
