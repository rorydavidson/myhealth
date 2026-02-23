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

  // ── French lab report aliases ────────────────────────────────────────────
  // Haematology (CBC / Numération globulaire)
  hématies: { code: "789-8", display: "Erythrocytes", system: LOINC_SYSTEM },
  "globules rouges": { code: "789-8", display: "Erythrocytes", system: LOINC_SYSTEM },
  hémoglobine: { code: "718-7", display: "Hemoglobin", system: LOINC_SYSTEM },
  hematocrite: { code: "20570-8", display: "Hematocrit", system: LOINC_SYSTEM },
  hématocrite: { code: "20570-8", display: "Hematocrit", system: LOINC_SYSTEM },
  "v.g.m.": { code: "787-2", display: "MCV", system: LOINC_SYSTEM },
  vgm: { code: "787-2", display: "MCV", system: LOINC_SYSTEM },
  "t.c.m.h.": { code: "785-6", display: "MCH", system: LOINC_SYSTEM },
  tcmh: { code: "785-6", display: "MCH", system: LOINC_SYSTEM },
  "c.c.m.h.": { code: "786-4", display: "MCHC", system: LOINC_SYSTEM },
  ccmh: { code: "786-4", display: "MCHC", system: LOINC_SYSTEM },
  leucocytes: { code: "6690-2", display: "Leukocytes", system: LOINC_SYSTEM },
  "globules blancs": { code: "6690-2", display: "Leukocytes", system: LOINC_SYSTEM },
  plaquettes: { code: "777-3", display: "Platelets", system: LOINC_SYSTEM },
  "polynucléaires neutrophiles": {
    code: "751-8",
    display: "Neutrophils",
    system: LOINC_SYSTEM,
  },
  "polynucléaires éosinophiles": {
    code: "711-2",
    display: "Eosinophils",
    system: LOINC_SYSTEM,
  },
  "polynucléaires basophiles": {
    code: "704-7",
    display: "Basophils",
    system: LOINC_SYSTEM,
  },
  lymphocytes: { code: "731-0", display: "Lymphocytes", system: LOINC_SYSTEM },
  monocytes: { code: "742-7", display: "Monocytes", system: LOINC_SYSTEM },

  // Biochemistry (Biochimie sanguine)
  sodium: { code: "2951-2", display: "Sodium", system: LOINC_SYSTEM },
  potassium: { code: "2823-3", display: "Potassium", system: LOINC_SYSTEM },
  "glycemie a jeun": { code: "1558-6", display: "Fasting glucose", system: LOINC_SYSTEM },
  "glycémie à jeun": { code: "1558-6", display: "Fasting glucose", system: LOINC_SYSTEM },
  glycémie: { code: "1558-6", display: "Fasting glucose", system: LOINC_SYSTEM },
  uree: { code: "3094-0", display: "Urea nitrogen", system: LOINC_SYSTEM },
  urée: { code: "3094-0", display: "Urea nitrogen", system: LOINC_SYSTEM },
  creatinine: { code: "2160-0", display: "Creatinine", system: LOINC_SYSTEM },
  créatinine: { code: "2160-0", display: "Creatinine", system: LOINC_SYSTEM },
  "debit de filtration glomerulaire": {
    code: "33914-3",
    display: "eGFR (CKD-EPI)",
    system: LOINC_SYSTEM,
  },
  "débit de filtration glomérulaire": {
    code: "33914-3",
    display: "eGFR (CKD-EPI)",
    system: LOINC_SYSTEM,
  },
  crp: { code: "1988-5", display: "CRP", system: LOINC_SYSTEM },
  "proteines totales": { code: "2885-2", display: "Protein total", system: LOINC_SYSTEM },
  "protéines totales": { code: "2885-2", display: "Protein total", system: LOINC_SYSTEM },
  calcium: { code: "17861-6", display: "Calcium", system: LOINC_SYSTEM },
  ferritine: { code: "2276-4", display: "Ferritin", system: LOINC_SYSTEM },

  // Lipid panel (Bilan lipidique)
  "cholesterol total": { code: "2093-3", display: "Cholesterol total", system: LOINC_SYSTEM },
  "cholestérol total": { code: "2093-3", display: "Cholesterol total", system: LOINC_SYSTEM },
  "cholesterol hdl": { code: "2085-9", display: "HDL Cholesterol", system: LOINC_SYSTEM },
  "cholestérol hdl": { code: "2085-9", display: "HDL Cholesterol", system: LOINC_SYSTEM },
  "cholesterol ldl": { code: "2089-1", display: "LDL Cholesterol", system: LOINC_SYSTEM },
  "cholestérol ldl": { code: "2089-1", display: "LDL Cholesterol", system: LOINC_SYSTEM },
  triglycérides: { code: "2571-8", display: "Triglycerides", system: LOINC_SYSTEM },

  // Liver enzymes (Bilan hépatique)
  "asat - transaminases sgot": {
    code: "1920-8",
    display: "AST",
    system: LOINC_SYSTEM,
  },
  asat: { code: "1920-8", display: "AST", system: LOINC_SYSTEM },
  sgot: { code: "1920-8", display: "AST", system: LOINC_SYSTEM },
  "alat - transaminases sgpt": {
    code: "1742-6",
    display: "ALT",
    system: LOINC_SYSTEM,
  },
  alat: { code: "1742-6", display: "ALT", system: LOINC_SYSTEM },
  sgpt: { code: "1742-6", display: "ALT", system: LOINC_SYSTEM },
  "ggt - gamma-glutamyl-transferase": {
    code: "2324-2",
    display: "GGT",
    system: LOINC_SYSTEM,
  },
  ggt: { code: "2324-2", display: "GGT", system: LOINC_SYSTEM },
  "pal - phosphatases alcalines": {
    code: "6768-6",
    display: "Alkaline Phosphatase",
    system: LOINC_SYSTEM,
  },
  "phosphatases alcalines": {
    code: "6768-6",
    display: "Alkaline Phosphatase",
    system: LOINC_SYSTEM,
  },
  pal: { code: "6768-6", display: "Alkaline Phosphatase", system: LOINC_SYSTEM },
  "bilirubine totale": { code: "1975-2", display: "Bilirubin total", system: LOINC_SYSTEM },

  // Thyroid (Hormonologie)
  "tsh #": { code: "3016-3", display: "TSH", system: LOINC_SYSTEM },

  // Protein electrophoresis fractions
  albumine: { code: "1751-7", display: "Albumin", system: LOINC_SYSTEM },
};
