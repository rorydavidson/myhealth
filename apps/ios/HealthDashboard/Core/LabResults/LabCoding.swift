import Foundation

/// Maps normalised lab test name strings to LOINC codes.
///
/// Keys are lowercase, whitespace-trimmed test names (including common
/// abbreviations and French equivalents). The extraction pipeline normalises
/// extracted test names before lookup.
///
/// Mirrors `LAB_CODING` in `packages/shared/src/coding/lab-coding.ts`.
struct LoincEntry {
    let code: String
    let display: String
}

let labCoding: [String: LoincEntry] = {
    // English / universal
    var d: [String: LoincEntry] = [
        // Lipid panel
        "total cholesterol":    .init(code: "2093-3",  display: "Cholesterol [Mass/volume] in Serum or Plasma"),
        "cholesterol":          .init(code: "2093-3",  display: "Cholesterol [Mass/volume] in Serum or Plasma"),
        "hdl cholesterol":      .init(code: "2085-9",  display: "HDL Cholesterol"),
        "hdl":                  .init(code: "2085-9",  display: "HDL Cholesterol"),
        "ldl cholesterol":      .init(code: "2089-1",  display: "LDL Cholesterol"),
        "ldl":                  .init(code: "2089-1",  display: "LDL Cholesterol"),
        "triglycerides":        .init(code: "2571-8",  display: "Triglycerides"),

        // Glucose / diabetes
        "hemoglobin a1c":       .init(code: "4548-4",  display: "Hemoglobin A1c/Hemoglobin.total in Blood"),
        "hba1c":                .init(code: "4548-4",  display: "Hemoglobin A1c/Hemoglobin.total in Blood"),
        "a1c":                  .init(code: "4548-4",  display: "Hemoglobin A1c/Hemoglobin.total in Blood"),
        "fasting glucose":      .init(code: "1558-6",  display: "Fasting glucose"),
        "glucose":              .init(code: "1558-6",  display: "Fasting glucose"),

        // Thyroid
        "tsh":                  .init(code: "3016-3",  display: "TSH"),
        "tsh #":                .init(code: "3016-3",  display: "TSH"),
        "free t4":              .init(code: "3024-7",  display: "Free T4"),
        "free t3":              .init(code: "3051-0",  display: "Free T3"),

        // CBC
        "hemoglobin":           .init(code: "718-7",   display: "Hemoglobin"),
        "wbc":                  .init(code: "6690-2",  display: "Leukocytes"),
        "white blood cells":    .init(code: "6690-2",  display: "Leukocytes"),
        "rbc":                  .init(code: "789-8",   display: "Erythrocytes"),
        "red blood cells":      .init(code: "789-8",   display: "Erythrocytes"),
        "platelets":            .init(code: "777-3",   display: "Platelets"),
        "hematocrit":           .init(code: "20570-8", display: "Hematocrit"),
        "mcv":                  .init(code: "787-2",   display: "MCV"),
        "mch":                  .init(code: "785-6",   display: "MCH"),
        "mchc":                 .init(code: "786-4",   display: "MCHC"),
        "neutrophils":          .init(code: "751-8",   display: "Neutrophils"),
        "lymphocytes":          .init(code: "731-0",   display: "Lymphocytes"),
        "monocytes":            .init(code: "742-7",   display: "Monocytes"),
        "eosinophils":          .init(code: "711-2",   display: "Eosinophils"),
        "basophils":            .init(code: "704-7",   display: "Basophils"),

        // Metabolic / renal
        "sodium":               .init(code: "2951-2",  display: "Sodium"),
        "potassium":            .init(code: "2823-3",  display: "Potassium"),
        "creatinine":           .init(code: "2160-0",  display: "Creatinine"),
        "urea":                 .init(code: "3094-0",  display: "Urea nitrogen"),
        "bun":                  .init(code: "3094-0",  display: "Urea nitrogen"),
        "egfr":                 .init(code: "33914-3", display: "eGFR (CKD-EPI)"),
        "calcium":              .init(code: "17861-6", display: "Calcium"),
        "crp":                  .init(code: "1988-5",  display: "CRP"),
        "protein total":        .init(code: "2885-2",  display: "Protein total"),
        "albumin":              .init(code: "1751-7",  display: "Albumin"),
        "ferritin":             .init(code: "2276-4",  display: "Ferritin"),

        // Liver
        "ast":                  .init(code: "1920-8",  display: "AST"),
        "sgot":                 .init(code: "1920-8",  display: "AST"),
        "alt":                  .init(code: "1742-6",  display: "ALT"),
        "sgpt":                 .init(code: "1742-6",  display: "ALT"),
        "ggt":                  .init(code: "2324-2",  display: "GGT"),
        "alkaline phosphatase": .init(code: "6768-6",  display: "Alkaline Phosphatase"),
        "alp":                  .init(code: "6768-6",  display: "Alkaline Phosphatase"),
        "bilirubin":            .init(code: "1975-2",  display: "Bilirubin total"),
        "total bilirubin":      .init(code: "1975-2",  display: "Bilirubin total"),

        // ── French aliases ───────────────────────────────────────────────────
        // Haematologie
        "hématies":                       .init(code: "789-8",   display: "Erythrocytes"),
        "globules rouges":                .init(code: "789-8",   display: "Erythrocytes"),
        "hémoglobine":                    .init(code: "718-7",   display: "Hemoglobin"),
        "hematocrite":                    .init(code: "20570-8", display: "Hematocrit"),
        "hématocrite":                    .init(code: "20570-8", display: "Hematocrit"),
        "v.g.m.":                         .init(code: "787-2",   display: "MCV"),
        "vgm":                            .init(code: "787-2",   display: "MCV"),
        "t.c.m.h.":                       .init(code: "785-6",   display: "MCH"),
        "tcmh":                           .init(code: "785-6",   display: "MCH"),
        "c.c.m.h.":                       .init(code: "786-4",   display: "MCHC"),
        "ccmh":                           .init(code: "786-4",   display: "MCHC"),
        "leucocytes":                     .init(code: "6690-2",  display: "Leukocytes"),
        "globules blancs":                .init(code: "6690-2",  display: "Leukocytes"),
        "plaquettes":                     .init(code: "777-3",   display: "Platelets"),
        "polynucléaires neutrophiles":    .init(code: "751-8",   display: "Neutrophils"),
        "polynucléaires éosinophiles":    .init(code: "711-2",   display: "Eosinophils"),
        "polynucléaires basophiles":      .init(code: "704-7",   display: "Basophils"),

        // Biochimie
        "glycemie a jeun":                .init(code: "1558-6",  display: "Fasting glucose"),
        "glycémie à jeun":                .init(code: "1558-6",  display: "Fasting glucose"),
        "glycémie":                       .init(code: "1558-6",  display: "Fasting glucose"),
        "uree":                           .init(code: "3094-0",  display: "Urea nitrogen"),
        "urée":                           .init(code: "3094-0",  display: "Urea nitrogen"),
        "créatinine":                     .init(code: "2160-0",  display: "Creatinine"),
        "debit de filtration glomerulaire": .init(code: "33914-3", display: "eGFR (CKD-EPI)"),
        "débit de filtration glomérulaire": .init(code: "33914-3", display: "eGFR (CKD-EPI)"),
        "proteines totales":              .init(code: "2885-2",  display: "Protein total"),
        "protéines totales":              .init(code: "2885-2",  display: "Protein total"),
        "ferritine":                      .init(code: "2276-4",  display: "Ferritin"),

        // Bilan lipidique
        "cholesterol total":              .init(code: "2093-3",  display: "Cholesterol total"),
        "cholestérol total":              .init(code: "2093-3",  display: "Cholesterol total"),
        "cholesterol hdl":                .init(code: "2085-9",  display: "HDL Cholesterol"),
        "cholestérol hdl":                .init(code: "2085-9",  display: "HDL Cholesterol"),
        "cholesterol ldl":                .init(code: "2089-1",  display: "LDL Cholesterol"),
        "cholestérol ldl":                .init(code: "2089-1",  display: "LDL Cholesterol"),
        "triglycérides":                  .init(code: "2571-8",  display: "Triglycerides"),

        // Bilan hépatique
        "asat - transaminases sgot":      .init(code: "1920-8",  display: "AST"),
        "asat":                           .init(code: "1920-8",  display: "AST"),
        "alat - transaminases sgpt":      .init(code: "1742-6",  display: "ALT"),
        "alat":                           .init(code: "1742-6",  display: "ALT"),
        "ggt - gamma-glutamyl-transferase": .init(code: "2324-2", display: "GGT"),
        "pal - phosphatases alcalines":   .init(code: "6768-6",  display: "Alkaline Phosphatase"),
        "phosphatases alcalines":         .init(code: "6768-6",  display: "Alkaline Phosphatase"),
        "pal":                            .init(code: "6768-6",  display: "Alkaline Phosphatase"),
        "bilirubine totale":              .init(code: "1975-2",  display: "Bilirubin total"),

        // Hormonologie
        "albumine":                       .init(code: "1751-7",  display: "Albumin"),
    ]
    return d
}()

/// Looks up the LOINC entry for a raw test name.
///
/// Normalises to lowercase and trims whitespace before lookup.
/// Returns `nil` if no mapping is found.
func lookupLoincCode(for rawName: String) -> LoincEntry? {
    labCoding[rawName.lowercased().trimmingCharacters(in: .whitespaces)]
}
