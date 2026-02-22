import type { ClinicalCode } from "./metric-coding.js";

const LOINC_SYSTEM = "http://loinc.org";

/**
 * Maps common lab test names to LOINC codes.
 * Used by the PDF extraction pipeline to auto-assign codes to extracted lab values.
 * Keys are normalized lowercase test names; the extraction pipeline should normalize
 * extracted test names before lookup.
 */
export const LAB_CODING: Record<string, ClinicalCode> = {
  // Lipid panel
  "total cholesterol": {
    code: "2093-3",
    display: "Cholesterol [Mass/volume] in Serum or Plasma",
    system: LOINC_SYSTEM,
  },
  cholesterol: {
    code: "2093-3",
    display: "Cholesterol [Mass/volume] in Serum or Plasma",
    system: LOINC_SYSTEM,
  },
  "hdl cholesterol": {
    code: "2085-9",
    display: "HDL Cholesterol",
    system: LOINC_SYSTEM,
  },
  hdl: {
    code: "2085-9",
    display: "HDL Cholesterol",
    system: LOINC_SYSTEM,
  },
  "ldl cholesterol": {
    code: "2089-1",
    display: "LDL Cholesterol",
    system: LOINC_SYSTEM,
  },
  ldl: {
    code: "2089-1",
    display: "LDL Cholesterol",
    system: LOINC_SYSTEM,
  },
  triglycerides: {
    code: "2571-8",
    display: "Triglycerides",
    system: LOINC_SYSTEM,
  },

  // Glucose / diabetes
  "hemoglobin a1c": {
    code: "4548-4",
    display: "Hemoglobin A1c/Hemoglobin.total in Blood",
    system: LOINC_SYSTEM,
  },
  hba1c: {
    code: "4548-4",
    display: "Hemoglobin A1c/Hemoglobin.total in Blood",
    system: LOINC_SYSTEM,
  },
  a1c: {
    code: "4548-4",
    display: "Hemoglobin A1c/Hemoglobin.total in Blood",
    system: LOINC_SYSTEM,
  },
  "fasting glucose": {
    code: "1558-6",
    display: "Fasting glucose",
    system: LOINC_SYSTEM,
  },
  glucose: {
    code: "1558-6",
    display: "Fasting glucose",
    system: LOINC_SYSTEM,
  },

  // Thyroid
  tsh: {
    code: "3016-3",
    display: "TSH",
    system: LOINC_SYSTEM,
  },
  "free t4": {
    code: "3024-7",
    display: "Free T4",
    system: LOINC_SYSTEM,
  },
  "free t3": {
    code: "3051-0",
    display: "Free T3",
    system: LOINC_SYSTEM,
  },

  // CBC
  hemoglobin: {
    code: "718-7",
    display: "Hemoglobin",
    system: LOINC_SYSTEM,
  },
  wbc: {
    code: "6690-2",
    display: "Leukocytes",
    system: LOINC_SYSTEM,
  },
  "white blood cells": {
    code: "6690-2",
    display: "Leukocytes",
    system: LOINC_SYSTEM,
  },
  rbc: {
    code: "789-8",
    display: "Erythrocytes",
    system: LOINC_SYSTEM,
  },
  "red blood cells": {
    code: "789-8",
    display: "Erythrocytes",
    system: LOINC_SYSTEM,
  },
  platelets: {
    code: "777-3",
    display: "Platelets",
    system: LOINC_SYSTEM,
  },
};
